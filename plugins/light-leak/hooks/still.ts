// The still frame of the backdrop, for wherever the shader does not play: the
// mobile app, Reduce Motion, builds before shaders, a shader that fails or
// runs slowly, and the README. It is the shader's own composition, worked out
// from the same numbers: a near-black warm ground, the leak's wide glow from
// just off the lower left corner, a faint wash down the right edge that is
// strongest at the top, a little warmth pooled under the prompt box, the same
// gentle vignette and a fine, still grain. Night has the deeper, rosier base
// and a rose-amber light.

type Rgb = readonly [number, number, number]

/** The shader's colours, linear 0 to 1 and read as sRGB. */
const BASE = { day: [0.045, 0.04, 0.037], night: [0.04, 0.033, 0.033] } as const
const AMBER: Rgb = [0.75, 0.42, 0.24]
const DUSK: Rgb = [0.8, 0.45, 0.36]
const CORE: Rgb = [0.9, 0.75, 0.6]
/** How much light the leak adds: `colour * leak * 0.32`, as in the shader. */
const GAIN = 0.32

const W = 1600
const H = 1000

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function hex(c: Rgb): string {
  return `#${c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`
}

/** The base with `leak` of the light added, and the faint hot core over it. */
function lit(base: Rgb, light: Rgb, leak: number): string {
  const core = leak ** 3 * 0.06
  const at = (i: 0 | 1 | 2): number => base[i] + light[i] * leak * GAIN + CORE[i] * core
  return hex([at(0), at(1), at(2)])
}

const round = (v: number): string => String(Math.round(v * 1000) / 1000)

/** Stops along a falloff, each as opaque as the falloff is there: one colour over the ground. */
function stops(color: string, at: readonly number[], fall: (x: number) => number): string {
  return at.map(x => `<stop offset="${round(x)}" stop-color="${color}" stop-opacity="${round(fall(x))}"/>`).join('')
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Offsets in twentieths: enough stops that a falloff reads as one curve, with no rings. */
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20)

/** One frame of the backdrop, by day or by night. */
export function stillSvg(isNight: boolean): string {
  const base: Rgb = isNight ? BASE.night : BASE.day
  // Night runs from dusk to dawn, so its light leans toward their rose-amber.
  const light = isNight ? mix(AMBER, DUSK, 0.5) : AMBER
  const peak = isNight ? 0.66 : 0.72
  // The corner: the shader's exp(-d * d * 2.0), reaching d = 1.3 at the gradient's edge.
  const reach = 1.3
  const corner = stops(lit(base, light, peak), STEPS, x => Math.exp(-((x * reach) ** 2) * 2))
  // The right edge: in from x 0.55, strongest at the top.
  const edge = stops(lit(base, light, 0.16), STEPS, x => smooth(0.55, 1.08, 0.55 + x * 0.45))
  const rise = STEPS.map(x => `<stop offset="${x}" stop-color="#fff" stop-opacity="${round(smooth(0, 0.7, 1 - x))}"/>`).join('')
  // Under the prompt box, a pool of the same light.
  const pool = stops(lit(base, light, 0.12), STEPS, x => Math.exp(-((x * 2) ** 2)))
  // The vignette: the shader's mix(0.78, 1, smoothstep(1.2, 0.25, d)), as black over the frame.
  const shade = STEPS.map(x => `<stop offset="${x}" stop-color="#000" stop-opacity="${round(0.22 * (1 - smooth(1.2, 0.25, x * 1.2)))}"/>`).join('')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
    '<defs>',
    `<radialGradient id="ll-corner" gradientUnits="userSpaceOnUse" cx="-80" cy="950" r="${1000 * reach}" gradientTransform="translate(-80 950) scale(1.11 1) translate(80 -950)">${corner}</radialGradient>`,
    `<linearGradient id="ll-edge" x1="0" y1="0" x2="1" y2="0">${edge}</linearGradient>`,
    `<linearGradient id="ll-rise" x1="0" y1="0" x2="0" y2="1">${rise}</linearGradient>`,
    '<mask id="ll-top"><rect x="880" width="720" height="1000" fill="url(#ll-rise)"/></mask>',
    `<radialGradient id="ll-pool" gradientUnits="userSpaceOnUse" cx="800" cy="1000" r="640" gradientTransform="translate(800 1000) scale(1 0.32) translate(-800 -1000)">${pool}</radialGradient>`,
    `<radialGradient id="ll-shade" gradientUnits="userSpaceOnUse" cx="800" cy="520" r="1000" gradientTransform="translate(800 520) scale(1.67 1) translate(-800 -520)">${shade}</radialGradient>`,
    '<filter id="ll-grain" x="0" y="0" width="100%" height="100%">',
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>',
    '<feColorMatrix values="1.6 0 0 0 -0.64 1.5 0 0 0 -0.62 1.4 0 0 0 -0.6 0 0 0 0 1"/>',
    '</filter>',
    '</defs>',
    '<!-- the film base -->',
    `<rect width="${W}" height="${H}" fill="${hex(base)}"/>`,
    '<!-- light seeping in at the lower left -->',
    `<rect width="${W}" height="${H}" fill="url(#ll-corner)"/>`,
    '<!-- a fainter wash down the right edge -->',
    '<rect x="880" width="720" height="1000" fill="url(#ll-edge)" mask="url(#ll-top)"/>',
    '<!-- warmth under the prompt box -->',
    '<rect y="760" width="1600" height="240" fill="url(#ll-pool)"/>',
    '<!-- the vignette and a fine, still grain -->',
    `<rect width="${W}" height="${H}" fill="url(#ll-shade)"/>`,
    `<rect width="${W}" height="${H}" filter="url(#ll-grain)" opacity="0.035"/>`,
    '</svg>',
  ].join('')
}

export const STILL_ALT = 'Warm amber light seeping in at the lower left corner of a dark film frame, with a fainter glow along the right edge'
