// Pixel art as compact SVG. Everything is drawn on one grid of whole art
// pixels: a Layer gathers runs of one fill, merges each run with the same run
// in the rows below it, and writes one <path> per fill. Dithering uses ordered
// (Bayer) patterns tiled on the same grid.

/** A sprite: rows of equal length, one character per pixel, `.` for none. */
export type Sprite = readonly string[]

/** What each character of a sprite paints. A character with no entry paints nothing. */
export type Inks = Readonly<Record<string, string>>

type Run = { x: number; y: number; w: number; h: number }

export class Layer {
  private readonly fills = new Map<string, Run[]>()

  /** A block of pixels. */
  rect(x: number, y: number, w: number, h: number, fill: string): this {
    if (w <= 0 || h <= 0) return this
    const runs = this.fills.get(fill) ?? []
    runs.push({ x, y, w, h })
    this.fills.set(fill, runs)
    return this
  }

  /** One pixel. */
  dot(x: number, y: number, fill: string): this {
    return this.rect(x, y, 1, 1, fill)
  }

  /** A sprite with its top-left pixel at (x, y), mirrored left to right when `flip`. */
  sprite(rows: Sprite, inks: Inks, x: number, y: number, flip = false): this {
    rows.forEach((source, r) => {
      const row = flip ? [...source].reverse().join('') : source
      let start = 0
      while (start < row.length) {
        const ch = row[start] ?? '.'
        let end = start + 1
        while (end < row.length && row[end] === ch) end += 1
        const fill = inks[ch]
        if (fill !== undefined) this.rect(x + start, y + r, end - start, 1, fill)
        start = end
      }
    })
    return this
  }

  get isEmpty(): boolean {
    return this.fills.size === 0
  }

  /** The layer as paths, one per fill, wrapped in a <g> when given attributes. */
  svg(attributes = ''): string {
    let out = ''
    for (const [fill, runs] of this.fills) out += `<path fill="${fill}" d="${pathData(runs)}"/>`
    return attributes === '' ? out : `<g ${attributes}>${out}</g>`
  }
}

/** Runs as path data, each run stacked onto the same run in the row above it. */
export function pathData(runs: readonly Run[]): string {
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x)
  const merged: Run[] = []
  const open = new Map<string, Run>()
  for (const run of sorted) {
    const key = `${run.x},${run.w}`
    const above = open.get(key)
    if (above !== undefined && above.y + above.h === run.y) {
      above.h += run.h
      continue
    }
    const copy = { ...run }
    merged.push(copy)
    open.set(key, copy)
  }
  return merged.map(r => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`).join('')
}

// The 4x4 ordered-dither threshold map.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const

/**
 * A pattern that paints `level` of every 16 pixels in `color`, the rest left
 * clear, tiled on the art grid. Fill a shape with `url(#id)` to dither it.
 */
export function ditherPattern(id: string, color: string, level: number): string {
  const runs: Run[] = []
  BAYER.forEach((row, y) => row.forEach((threshold, x) => (threshold < level ? runs.push({ x, y, w: 1, h: 1 }) : undefined)))
  return `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse"><path fill="${color}" d="${pathData(runs)}"/></pattern>`
}

/** Whether pixel (x, y) is lit at `level` of 16 by the same ordered map, for dithering drawn pixel by pixel. */
export function isLit(x: number, y: number, level: number): boolean {
  const threshold = BAYER[((y % 4) + 4) % 4]?.[((x % 4) + 4) % 4] ?? 16
  return threshold < level
}

/** A fixed stream of numbers in [0, 1), the same on every draw. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
