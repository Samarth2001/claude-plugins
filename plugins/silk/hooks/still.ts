// The still picture of the satin: what shows where the shader doesn't play.
// A few long folds sweep in an arc from the lower left up across the top, each
// shaded light to dark across its width, lit from the upper left, with one
// broad soft highlight on the crest of the main fold. A faint warm light rests
// low where the prompt box sits, and a vignette closes the corners. Night is
// the same cloth with the shader's violet cast.

/** Linear 0 to 1, read as sRGB, as the shader's colors are. */
type Rgb = readonly [number, number, number]

const CLOTH: { day: Rgb; night: Rgb } = { day: [0.05, 0.052, 0.06], night: [0.045, 0.042, 0.058] }
const SHEEN: { day: Rgb; night: Rgb } = { day: [0.42, 0.46, 0.52], night: [0.42, 0.38, 0.52] }
const WARM: Rgb = [0.85, 0.65, 0.5]

/**
 * One fold, or the valley between two: a ring around a centre off the lower
 * right, its crest `crest` units out, `width` its soft half-width, `strength`
 * the sheen's opacity there (the shade's, for a valley).
 */
type Fold = { cx: number; cy: number; crest: number; width: number; squash: number; tilt: number; strength: number }

// The main fold first, broad and lit; a softer one inside it; a faint one beyond.
const FOLDS: readonly Fold[] = [
  { cx: 1050, cy: 900, crest: 960, width: 170, squash: 0.92, tilt: -8, strength: 0.2 },
  { cx: 1120, cy: 960, crest: 600, width: 110, squash: 0.86, tilt: -14, strength: 0.07 },
  { cx: 1000, cy: 860, crest: 1400, width: 150, squash: 0.95, tilt: -4, strength: 0.05 },
]
// The valleys between them, darker than the bare cloth.
const VALLEYS: readonly Fold[] = [
  { cx: 1080, cy: 930, crest: 770, width: 110, squash: 0.9, tilt: -10, strength: 0.4 },
  { cx: 1020, cy: 880, crest: 1220, width: 90, squash: 0.94, tilt: -6, strength: 0.25 },
]
// Where a fold's profile is sampled, in half-widths from its crest. Each side
// falls away as a bell, steeper toward the light, so a fold reads rounded.
const STEPS = [-2.4, -1.6, -1, -0.5, 0, 0.6, 1.2, 1.9, 2.8] as const

function hex([r, g, b]: Rgb, gain = 1): string {
  const byte = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v * gain)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}`
}

const n = (v: number) => String(Math.round(v * 1000) / 1000)

/** A fold's gradient in one color, centred on the fold and squashed to its ellipse. */
function ring(id: string, fold: Fold, color: string): string {
  const { cx, cy, crest, width, strength } = fold
  const far = crest + width * 3
  const stops = STEPS.map(step => {
    const at = (crest + step * width) / far
    const fall = step < 0 ? step / 0.85 : step / 1.15
    return `<stop offset="${n(at)}" stop-color="${color}" stop-opacity="${n(strength * Math.exp(-fall * fall))}"/>`
  }).join('')
  return (
    `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${far}" ` +
    `gradientTransform="rotate(${fold.tilt} ${cx} ${cy}) translate(${cx} ${cy}) scale(1 ${fold.squash}) translate(${-cx} ${-cy})">${stops}</radialGradient>`
  )
}

const cover = (id: string) => `<rect x="-100" y="-100" width="1800" height="1200" fill="url(#${id})"/>`

/** The picture, by day or with the night's violet cast. */
export function stillSvg(isNight: boolean): string {
  const time = isNight ? 'night' : 'day'
  const cloth = CLOTH[time]
  const sheen = hex(SHEEN[time])
  const ground = hex(cloth, 1.05)
  const valley = hex(cloth, 0.55)
  const lit = hex(cloth, 1.45)
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">',
    '<defs>',
    // The light falls from the upper left: the cloth is a shade lighter there.
    `<linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lit}"/><stop offset="0.55" stop-color="${ground}"/><stop offset="1" stop-color="${valley}"/></linearGradient>`,
    FOLDS.map((fold, i) => ring(`f${i}`, fold, sheen)).join(''),
    VALLEYS.map((fold, i) => ring(`v${i}`, fold, valley)).join(''),
    // Where the sheen is: strongest high on the left, gone toward the lower right.
    '<linearGradient id="reach" x1="0" y1="0" x2="1" y2="0.8"><stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0.15"/></linearGradient>',
    '<mask id="lit"><rect width="1600" height="1000" fill="url(#reach)"/></mask>',
    `<radialGradient id="warm" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${hex(WARM)}" stop-opacity="0.05"/><stop offset="1" stop-color="${hex(WARM)}" stop-opacity="0"/></radialGradient>`,
    '<radialGradient id="vig" cx="0.5" cy="0.48" r="0.75"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></radialGradient>',
    // A fixed grain, so the dark gradients never band.
    '<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.6 0"/></filter>',
    '</defs>',
    // ground
    '<rect width="1600" height="1000" fill="url(#light)"/>',
    // folds
    VALLEYS.map((_, i) => cover(`v${i}`)).join(''),
    '<g mask="url(#lit)">',
    FOLDS.map((_, i) => cover(`f${i}`)).join(''),
    '</g>',
    // the warm light behind the prompt box
    '<ellipse cx="800" cy="930" rx="520" ry="210" fill="url(#warm)"/>',
    // vignette
    '<rect width="1600" height="1000" fill="url(#vig)"/>',
    // grain
    '<rect width="1600" height="1000" filter="url(#grain)" opacity="0.03"/>',
    '</svg>',
  ].join('')
}

/** One plain sentence about the picture, the same at every hour. */
export const STILL_ALT = 'Dark graphite satin in long, soft folds, sweeping in an arc from the lower left up across the top'
