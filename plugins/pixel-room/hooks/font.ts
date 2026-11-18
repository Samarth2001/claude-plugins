// A small pixel font for the room's few words: the desk calendar's month and
// day, a note's `+`. Glyphs are 3 by 5 art pixels, the marks narrower and M,
// N and W wider so they read. Drawn onto a Layer as plain pixels, so it needs
// no font and no <text>.

import type { Layer } from './pixels'

/** Each glyph's rows, top to bottom, `#` for a lit pixel. */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  'A': ['.#.', '#.#', '###', '#.#', '#.#'],
  'B': ['##.', '#.#', '##.', '#.#', '##.'],
  'C': ['.##', '#..', '#..', '#..', '.##'],
  'D': ['##.', '#.#', '#.#', '#.#', '##.'],
  'E': ['###', '#..', '##.', '#..', '###'],
  'F': ['###', '#..', '##.', '#..', '#..'],
  'G': ['.##', '#..', '#.#', '#.#', '.##'],
  'H': ['#.#', '#.#', '###', '#.#', '#.#'],
  'I': ['###', '.#.', '.#.', '.#.', '###'],
  'J': ['..#', '..#', '..#', '#.#', '.#.'],
  'K': ['#.#', '#.#', '##.', '#.#', '#.#'],
  'L': ['#..', '#..', '#..', '#..', '###'],
  'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  'N': ['#..#', '##.#', '#.##', '#..#', '#..#'],
  'O': ['.#.', '#.#', '#.#', '#.#', '.#.'],
  'P': ['##.', '#.#', '##.', '#..', '#..'],
  'Q': ['.#.', '#.#', '#.#', '##.', '.##'],
  'R': ['##.', '#.#', '##.', '#.#', '#.#'],
  'S': ['.##', '#..', '.#.', '..#', '##.'],
  'T': ['###', '.#.', '.#.', '.#.', '.#.'],
  'U': ['#.#', '#.#', '#.#', '#.#', '###'],
  'V': ['#.#', '#.#', '#.#', '.#.', '.#.'],
  'W': ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
  'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'],
  'Z': ['###', '..#', '.#.', '#..', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '!': ['#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'],
  ' ': ['..', '..', '..', '..', '..'],
}

/** The height of every glyph, in art pixels. */
export const GLYPH_HEIGHT = 5

/** The glyph for a character, upper-cased; an unknown one draws as `?`. */
function glyph(ch: string): readonly string[] {
  return GLYPHS[ch.toUpperCase()] ?? GLYPHS['?'] ?? []
}

/** How wide `text` draws, in art pixels, with one blank pixel between glyphs. */
export function textWidth(text: string): number {
  let width = 0
  for (const ch of text) width += (glyph(ch)[0]?.length ?? 0) + 1
  return Math.max(0, width - 1)
}

/** Draws `text` with its top-left pixel at (x, y) in `color`, and returns its width. */
export function glyphText(layer: Layer, text: string, x: number, y: number, color: string): number {
  let cx = x
  for (const ch of text) {
    const rows = glyph(ch)
    rows.forEach((row, r) => {
      let start = row.indexOf('#')
      while (start !== -1) {
        let end = start
        while (row[end] === '#') end += 1
        layer.rect(cx + start, y + r, end - start, 1, color)
        start = row.indexOf('#', end)
      }
    })
    cx += (rows[0]?.length ?? 0) + 1
  }
  return textWidth(text)
}
