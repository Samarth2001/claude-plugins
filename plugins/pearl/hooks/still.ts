// The still picture of the sheen: what shows wherever the shader doesn't run.
// A near-black ground, five wide soft patches of nacre (sage, pale blue,
// lilac, dusty rose and a violet low in the middle) overlapping like the inside
// of a shell, kept to the edges and the lower half so the middle stays calm,
// a vignette and a faint fixed grain. At night the ground is deeper and the
// tints cooler and fainter, as the shader's are.

type Patch = {
  /** Centre and radii, in the 1600 by 1000 frame. */
  cx: number
  cy: number
  rx: number
  ry: number
  /** The tint by day and by night, and its strength at the centre. */
  day: string
  night: string
  opacity: number
}

const PATCHES: readonly Patch[] = [
  // Sage, wide along the left.
  { cx: 220, cy: 500, rx: 680, ry: 560, day: '#98d8ac', night: '#8ccfb2', opacity: 0.14 },
  // Lilac, high in the middle, leaning left.
  { cx: 700, cy: 120, rx: 520, ry: 380, day: '#c49ae0', night: '#ae9ee2', opacity: 0.13 },
  // Dusty rose, down the right edge from the top corner.
  { cx: 1500, cy: 260, rx: 600, ry: 600, day: '#dca0b6', night: '#c4a0c4', opacity: 0.12 },
  // Pale blue, low on the left of the middle.
  { cx: 480, cy: 860, rx: 560, ry: 380, day: '#8cc4da', night: '#88b8de', opacity: 0.12 },
  // Violet with a touch of rose, low in the middle, where the prompt sits.
  { cx: 940, cy: 1020, rx: 600, ry: 320, day: '#cc96cc', night: '#ae9ad6', opacity: 0.14 },
]

/** The shader's ground, by day and by night: (0.04, 0.042, 0.05) and (0.035, 0.035, 0.045). */
const GROUND = { day: '#0a0b0d', night: '#09090b' } as const

const ROOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'

export const STILL_ALT = 'Soft, faint patches of pearly green, lilac, rose and blue blending over a near-black ground.'

const round = (value: number): string => String(Math.round(value * 1000) / 1000)

/** A soft bell of falloff from the centre out, so no patch shows an edge. */
const FALLOFF = [1, 0.93, 0.74, 0.48, 0.24, 0.08, 0] as const

function gradient(id: string, color: string, opacity: number): string {
  const stops = FALLOFF.map(
    (share, index) => `<stop offset="${round(index / (FALLOFF.length - 1))}" stop-color="${color}" stop-opacity="${round(opacity * share)}"/>`,
  )
  return `<radialGradient id="${id}">${stops.join('')}</radialGradient>`
}

/** The sheen as it stands, by day or by night. */
export function stillSvg(isNight: boolean): string {
  const look = isNight ? 'night' : 'day'
  // Night patches are a little fainter, as the shader's sheen is over its deeper ground.
  const fade = isNight ? 0.85 : 1
  const defs = [
    ...PATCHES.map((patch, index) => gradient(`p${index}`, patch[look], patch.opacity * fade)),
    '<radialGradient id="v" cx="0.5" cy="0.48" r="0.75">' +
      '<stop offset="0.45" stop-color="#000" stop-opacity="0"/>' +
      `<stop offset="1" stop-color="#000" stop-opacity="${isNight ? 0.32 : 0.24}"/>` +
      '</radialGradient>',
    '<filter id="g" x="0" y="0" width="1" height="1">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>' +
      '<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0"/>' +
      '</filter>',
  ]
  const patches = PATCHES.map(
    (patch, index) => `<ellipse cx="${patch.cx}" cy="${patch.cy}" rx="${patch.rx}" ry="${patch.ry}" fill="url(#p${index})"/>`,
  )
  return [
    ROOT,
    `<defs>${defs.join('')}</defs>`,
    `<rect width="1600" height="1000" fill="${GROUND[look]}"/>`,
    ...patches,
    '<rect width="1600" height="1000" fill="url(#v)"/>',
    '<rect width="1600" height="1000" filter="url(#g)" opacity="0.03"/>',
    '</svg>',
  ].join('')
}
