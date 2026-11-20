// The still picture: one quiet frame of the shader, for where it can't run.
// The same fields as hooks/shader.ts, in its own colours: slate drifting in
// from the upper left, sea teal from the upper right and the lower left, plum
// low on the right, the hearth's faint warmth under the prompt and the shader's
// soft vignette. At night the colours turn to the shader's night ones.

type Rgb = readonly [number, number, number]

/** The shader's colours, linear 0 to 1, read as sRGB just as the app reads them. */
const DAY = {
  base: [0.04, 0.045, 0.055],
  slate: [0.1, 0.16, 0.24],
  sea: [0.07, 0.19, 0.2],
  mauve: [0.17, 0.15, 0.21],
} as const satisfies Record<string, Rgb>
const NIGHT = {
  base: [0.035, 0.037, 0.05],
  slate: [0.11, 0.13, 0.26],
  sea: [0.06, 0.17, 0.2],
  mauve: [0.17, 0.11, 0.21],
} as const satisfies Record<string, Rgb>
const HEARTH: Rgb = [0.85, 0.6, 0.45]

const hex = (rgb: Rgb): string =>
  '#' + rgb.map(part => Math.round(part * 255).toString(16).padStart(2, '0')).join('')

/** One large soft field: an ellipse of colour that fades out from its middle. */
type Field = { id: string; color: keyof typeof DAY; cx: number; cy: number; rx: number; ry: number; turn: number; strength: number }

const FIELDS: readonly Field[] = [
  { id: 'sl', color: 'slate', cx: 330, cy: 250, rx: 820, ry: 520, turn: -18, strength: 1 },
  { id: 'se', color: 'sea', cx: 1330, cy: 230, rx: 640, ry: 420, turn: 24, strength: 0.95 },
  { id: 'sw', color: 'sea', cx: 120, cy: 900, rx: 560, ry: 360, turn: -8, strength: 0.7 },
  { id: 'mv', color: 'mauve', cx: 1180, cy: 860, rx: 760, ry: 440, turn: -14, strength: 0.95 },
  { id: 'sm', color: 'slate', cx: 620, cy: 720, rx: 620, ry: 300, turn: 6, strength: 0.55 },
]

function field(f: Field, colors: Record<keyof typeof DAY, Rgb>): string {
  const color = hex(colors[f.color])
  const stops = [
    [0, f.strength],
    [0.35, f.strength * 0.72],
    [0.7, f.strength * 0.26],
    [1, 0],
  ]
    .map(([at, opacity]) => `<stop offset="${at}" stop-color="${color}" stop-opacity="${Number(opacity).toFixed(3)}"/>`)
    .join('')
  // A unit circle stretched and turned into the field's ellipse.
  const shape = `translate(${f.cx} ${f.cy}) rotate(${f.turn}) scale(${f.rx} ${f.ry})`
  return `<radialGradient id="${f.id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="${shape}">${stops}</radialGradient>`
}

/** One frame of the field, by day or by night: the same picture in the shader's two sets of colours. */
export function stillSvg(isNight: boolean): string {
  const colors = isNight ? NIGHT : DAY
  const hearth = hex(HEARTH)
  const defs = [
    ...FIELDS.map(f => field(f, colors)),
    `<radialGradient id="hh" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(800 930) scale(620 260)"><stop offset="0" stop-color="${hearth}" stop-opacity="0.09"/><stop offset="0.45" stop-color="${hearth}" stop-opacity="0.045"/><stop offset="1" stop-color="${hearth}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="vg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(800 480) scale(1080 760)"><stop offset="0.3" stop-color="#000" stop-opacity="0"/><stop offset="0.75" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.24"/></radialGradient>`,
    '<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>',
  ].join('')
  const layers = [
    '<!-- ground -->',
    `<rect width="1600" height="1000" fill="${hex(colors.base)}"/>`,
    '<!-- fields -->',
    ...FIELDS.map(f => `<rect width="1600" height="1000" fill="url(#${f.id})"/>`),
    '<!-- the hearth under the prompt -->',
    '<rect width="1600" height="1000" fill="url(#hh)"/>',
    '<!-- vignette -->',
    '<rect width="1600" height="1000" fill="url(#vg)"/>',
    '<!-- grain -->',
    '<rect width="1600" height="1000" filter="url(#gr)" opacity="0.025"/>',
  ].join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${layers}</svg>`
}

export const STILL_ALT = 'Soft fields of deep slate, teal and plum over near-black, with a faint warm glow low in the middle.'
