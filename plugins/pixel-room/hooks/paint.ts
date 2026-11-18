// What every part of the room paints with: the grid's scale, the floor line,
// and the shared ordered-dither patterns, defined once in the scene's <defs>.
// A part that needs a pattern of its own writes its own <defs> beside its
// drawing, its ids prefixed with the part's letter.

import { PAL } from './palette'
import { ditherPattern } from './pixels'

/** Scene units per art pixel. */
export const PX = 5
/** The art row where the wall meets the floor. */
export const FLOOR = 160

export const P = PAL

// Dither patterns, each id once: `level` of 16 pixels in `color`.
export const PATTERNS: Record<string, [string, number]> = {
  'k1': [P.ink, 4],
  'k2': [P.ink, 8],
  'k3': [P.ink, 12],
  'n2': [P.night, 8],
  'a1': [P.amber, 1],
  'a2': [P.amber, 2],
  'a4': [P.amber, 4],
  'a6': [P.amber, 6],
  'm1': [P.mist, 1],
  'm2': [P.mist, 2],
  'm4': [P.mist, 4],
  's8': [P.sea, 8],
  's4': [P.sea, 4],
  'u8': [P.aubergine, 8],
  'u4': [P.aubergine, 4],
  'v8': [P.mauve, 8],
  't8': [P.steel, 8],
  't4': [P.steel, 4],
  'i8': [P.mist, 8],
  'r8': [P.rose, 8],
  'r4': [P.rose, 4],
  'b8': [P.amber, 8],
  'b4': [P.amber, 4],
  'd8': [P.dusk, 8],
  'w4': [P.umber, 4],
  'w8': [P.umber, 8],
  'w12': [P.umber, 12],
  'e8': [P.ember, 8],
  'e4': [P.ember, 4],
  'x8': [P.rust, 8],
  'x4': [P.rust, 4],
  'k4': [P.ink, 2],
}
export const pat = (id: keyof typeof PATTERNS & string) => `url(#q${id})`

/** The shared patterns, for the scene's one <defs>. */
export function defs(): string {
  return Object.entries(PATTERNS)
    .map(([id, [color, level]]) => ditherPattern(`q${id}`, color, level))
    .join('')
}
