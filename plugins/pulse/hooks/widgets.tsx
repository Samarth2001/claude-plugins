// Small graphics, one per idea, each drawn the way its surface draws best: a
// Raster of colored cells in the terminal, an animated Svg everywhere else.
// Every widget is one row tall unless asked for more, so the band stays slim.

import type { ElementTable, RenderElement } from 'claude-code'

import { heat } from './calc'

export type Surface = { ui: ElementTable; isTerminal: boolean }

export const ACCENT = '#B4A7F5'
export const BLUE = '#7FB2F0'
const TRACK = '#4B5260'
const DEFAULT = 0x01000000
const PX = 8 // desktop pixels per cell, for sizing an Svg beside text
const ROW_PX = 16

const hex = (color: string) => parseInt(color.slice(1), 16)

// Mixes two #rrggbb colors; t 0 is a, 1 is b.
export function mix(a: string, b: string, t: number): string {
  const x = hex(a)
  const y = hex(b)
  const c = (shift: number) => Math.round(((x >> shift) & 255) * (1 - t) + ((y >> shift) & 255) * t)
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`
}

// A Raster's cells: one [char, fg, bg] per cell, row-major.
type Cell = [string, string | null, string | null]

function raster(s: Surface, key: string, cells: Cell[][]): RenderElement {
  const { Raster } = s.ui as ElementTable<'terminal'>
  const rows = cells.length
  const columns = cells[0]?.length ?? 0
  const words = new Uint32Array(rows * columns * 3)
  let i = 0
  for (const row of cells) {
    for (const [ch, fg, bg] of row) {
      words[i++] = ch.codePointAt(0) ?? 32
      words[i++] = fg ? hex(fg) : DEFAULT
      words[i++] = bg ? hex(bg) : DEFAULT
    }
  }
  return <Raster key={key} columns={columns} rows={rows} cells={base64(new Uint8Array(words.buffer))} />
}

function svg(s: Surface, key: string, alt: string, cols: number, rows: number, body: string): RenderElement {
  const { Box, Svg } = s.ui as ElementTable<'desktop'>
  const w = cols * PX
  const tall = rows * ROW_PX
  // color-scheme keeps the sandboxed frame transparent on a dark app.
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${tall}" viewBox="0 0 ${w} ${tall}" style="color-scheme:light dark;background:transparent">${body.replace(/\n\s*/g, '')}</svg>`
  return (
    <Box key={key} flexShrink={0}>
      <Svg source={source} alt={alt} width={w} height={tall} isInteractive />
    </Box>
  )
}

// The heartbeat: a trace that scrolls while Claude works, its head bright and
// its tail fading; a flat line at rest.
const BEAT = '⣀⣀⣀⡠⠊⠑⢄⣀⣀⣀⣀⣀⡠⠔⠁⠈⠢⣀⣀⣀'
export function wave(s: Surface, isWorking: boolean, frame: number, cols: number): RenderElement {
  if (s.isTerminal) {
    const row: Cell[] = []
    for (let i = 0; i < cols; i++) {
      const ch = isWorking ? (BEAT[(frame + i) % BEAT.length] ?? '⣀') : '⣀'
      row.push([ch, isWorking ? mix(TRACK, ACCENT, ((i + 1) / cols) ** 1.5) : TRACK, null])
    }
    return raster(s, 'wave', [row])
  }
  const w = cols * PX
  const mid = ROW_PX / 2
  if (!isWorking) {
    return svg(s, 'wave', 'idle', cols, 1, `<line x1="1" y1="${mid}" x2="${w - 6}" y2="${mid}" stroke="${TRACK}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${w - 3}" cy="${mid}" r="2.5" fill="${TRACK}"/>`)
  }
  // One beat is 24px; two in a row slide left by one beat, forever.
  const beat = (x: number) => `M${x} ${mid}h7l2 -5l3 10l2.5 -8l1.5 3h8`
  const path = Array.from({ length: Math.ceil(w / 24) + 2 }, (_, i) => beat(i * 24)).join('')
  return svg(s, 'wave', 'working', cols, 1, `
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/><stop offset="1" stop-color="${ACCENT}"/></linearGradient>
    <clipPath id="c"><rect width="${w - 8}" height="${ROW_PX}"/></clipPath></defs>
    <g clip-path="url(#c)"><path d="${path}" fill="none" stroke="url(#g)" stroke-width="1.5" stroke-linejoin="round">
      <animateTransform attributeName="transform" type="translate" from="0 0" to="-24 0" dur="1.1s" repeatCount="indefinite"/></path></g>
    <circle cx="${w - 3}" cy="${mid}" r="2.5" fill="${ACCENT}"/>
    <circle cx="${w - 3}" cy="${mid}" r="2.5" fill="none" stroke="${ACCENT}">
      <animate attributeName="r" values="2.5;6" dur="1.1s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0" dur="1.1s" repeatCount="indefinite"/></circle>`)
}

// A slim meter: a heat gradient up to `percent`, a track after it, and a tick
// where an even pace would be. `from` slides the fill in from an old value.
export function bar(s: Surface, key: string, percent: number, cols: number, mark?: number, from?: number): RenderElement {
  const p = clamp(percent)
  if (s.isTerminal) {
    const filled = (p / 100) * cols
    const markAt = mark === undefined ? -1 : Math.min(cols - 1, Math.floor((clamp(mark) / 100) * cols))
    const row: Cell[] = []
    for (let i = 0; i < cols; i++) {
      const color = heat(((i + 0.5) / cols) * 100)
      let cell: Cell
      if (i < Math.floor(filled)) cell = ['━', color, null]
      else if (i < filled && filled - i >= 0.35) cell = ['╸', color, null]
      else cell = ['─', TRACK, null]
      if (i === markAt) cell = [i < filled ? '╋' : '┼', ACCENT, null]
      row.push(cell)
    }
    return raster(s, key, [row])
  }
  const w = cols * PX
  const fill = (p / 100) * w
  const start = from === undefined ? fill : (clamp(from) / 100) * w
  const slide = start === fill ? '' : `<animate attributeName="width" from="${start}" to="${fill}" dur="0.9s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>`
  const x = mark === undefined ? undefined : (clamp(mark) / 100) * w
  return svg(s, key, `${Math.round(p)}%`, cols, 1, `
    <defs><linearGradient id="h" gradientUnits="userSpaceOnUse" x1="0" x2="${w}">
      <stop offset="0" stop-color="${heat(0)}"/><stop offset="0.5" stop-color="${heat(50)}"/><stop offset="0.75" stop-color="${heat(75)}"/><stop offset="1" stop-color="${heat(95)}"/></linearGradient></defs>
    <rect x="0" y="6" width="${w}" height="4" rx="2" fill="${TRACK}" fill-opacity="0.45"/>
    <rect x="0" y="6" width="${fill}" height="4" rx="2" fill="url(#h)">${slide}</rect>
    ${x === undefined ? '' : `<rect x="${Math.max(0, x - 1)}" y="3" width="2" height="10" rx="1" fill="${ACCENT}"><title>even pace</title></rect>`}`)
}

// Context as a ring on desktop; a one-cell level glyph in the terminal.
export function ring(s: Surface, percent: number, from?: number): RenderElement {
  const p = clamp(percent)
  if (s.isTerminal) {
    const levels = '▁▂▃▄▅▆▇█'
    return raster(s, 'ring', [[[levels[Math.min(7, Math.floor((p / 100) * 8))] ?? '▁', heat(p), null]]])
  }
  const r = 5.5
  const c = 2 * Math.PI * r
  const dash = (v: number) => `${((clamp(v) / 100) * c).toFixed(2)} ${c.toFixed(2)}`
  const grow = from === undefined || from === p ? '' : `<animate attributeName="stroke-dasharray" from="${dash(from)}" to="${dash(p)}" dur="0.9s" fill="freeze"/>`
  return svg(s, 'ring', `context ${Math.round(p)}%`, 2, 1, `
    <circle cx="8" cy="8" r="${r}" fill="none" stroke="${TRACK}" stroke-opacity="0.45" stroke-width="2.5"/>
    <circle cx="8" cy="8" r="${r}" fill="none" stroke="${heat(p)}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${dash(p)}" transform="rotate(-90 8 8)">${grow}</circle>`)
}

// Columns for a series, `rows` tall; the last one is "now" and glows.
// `labels`, on desktop, are drawn under the bars.
export function columns(s: Surface, key: string, values: number[], width: number, gap: number, rows: number, labels?: string[]): RenderElement {
  const peak = Math.max(...values, 0)
  const cols = values.length * (width + gap) - gap
  if (s.isTerminal) {
    const levels = ' ▁▂▃▄▅▆▇█'
    const grid: Cell[][] = Array.from({ length: rows }, () => [])
    values.forEach((v, i) => {
      const isNow = i === values.length - 1
      const color = isNow ? ACCENT : BLUE
      let level = peak > 0 ? Math.round((v / peak) * rows * 8) : 0
      if (v > 0 && level === 0) level = 1
      for (let r = rows - 1; r >= 0; r--) {
        const here = Math.min(8, level)
        level -= here
        const ch = here === 0 && r === rows - 1 ? '▁' : (levels[here] ?? ' ')
        const fg = here === 0 && r === rows - 1 ? TRACK : color
        for (let k = 0; k < width; k++) grid[r]?.push([ch, fg, null])
        if (i < values.length - 1) for (let k = 0; k < gap; k++) grid[r]?.push([' ', null, null])
      }
    })
    return raster(s, key, grid)
  }
  const tall = rows * ROW_PX - (labels ? 12 : 0)
  const unit = PX
  const rects = values.map((v, i) => {
    const bh = peak > 0 ? Math.max(v > 0 ? 2 : 0, (v / peak) * (tall - 2)) : 0
    const x = i * (width + gap) * unit
    const isNow = i === values.length - 1
    return `<rect x="${x}" y="${tall - 1.5}" width="${width * unit - 2}" height="1.5" rx="0.75" fill="${TRACK}" fill-opacity="0.5"/>` +
      (bh > 0 ? `<rect x="${x}" y="${tall - bh}" width="${width * unit - 2}" height="${bh}" rx="2" fill="${isNow ? ACCENT : BLUE}" fill-opacity="${isNow ? 1 : 0.85}"><title>${v.toFixed(2)}</title><animate attributeName="height" from="0" to="${bh}" dur="0.6s" fill="freeze"/><animate attributeName="y" from="${tall}" to="${tall - bh}" dur="0.6s" fill="freeze"/></rect>` : '')
  })
  const text = (labels ?? []).map((l, i) => `<text x="${i * (width + gap) * unit + (width * unit - 2) / 2}" y="${rows * ROW_PX - 1}" font-size="9" font-family="system-ui,sans-serif" text-anchor="middle" fill="#8B8F98">${l}</text>`)
  return svg(s, key, 'spend per period', cols, rows, rects.join('') + text.join(''))
}

// A history line, 0-100 each: heat-colored eighths in the terminal, a soft
// area with a dot on the latest reading elsewhere.
export function area(s: Surface, key: string, values: number[], cols: number): RenderElement {
  const shown = values.slice(-cols)
  if (s.isTerminal) {
    const levels = '▁▂▃▄▅▆▇█'
    const row: Cell[] = shown.map(v => [levels[Math.min(7, Math.round((clamp(v) / 100) * 7))] ?? '▁', heat(v), null])
    while (row.length < cols) row.unshift(['▁', TRACK, null])
    return raster(s, key, [row])
  }
  const w = cols * PX
  const tall = ROW_PX
  const step = shown.length > 1 ? (w - 4) / (shown.length - 1) : 0
  const pts = shown.map((v, i) => [2 + i * step, tall - 2 - (clamp(v) / 100) * (tall - 4)] as const)
  const last = pts.at(-1) ?? [w - 2, tall - 2]
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  const color = heat(shown.at(-1) ?? 0)
  return svg(s, key, 'context per turn', cols, 1, `
    <defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${pts.length > 1 ? `<path d="${line}L${last[0]} ${tall}L2 ${tall}Z" fill="url(#a)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>` : ''}
    <circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${color}"/>`)
}

// Turns side by side, each as wide as it was long; an interrupted one orange.
export function timeline(s: Surface, key: string, turns: { ms: number; isAborted: boolean }[], cols: number): RenderElement {
  const shown = turns.slice(-Math.max(1, Math.floor(cols / 2)))
  const total = shown.reduce((a, t) => a + t.ms, 0) || 1
  const room = cols - (shown.length - 1)
  const widths = shown.map(t => Math.max(1, Math.round((t.ms / total) * room)))
  const color = (i: number) => (shown[i]?.isAborted ? '#E8964A' : i === shown.length - 1 ? ACCENT : i % 2 ? BLUE : mix(BLUE, '#3E6FB0', 0.5))
  if (s.isTerminal) {
    const row: Cell[] = []
    widths.forEach((w, i) => {
      for (let k = 0; k < w; k++) row.push(['━', color(i), null])
      if (i < widths.length - 1) row.push([' ', null, null])
    })
    while (row.length < cols) row.push(['─', TRACK, null])
    return raster(s, key, [row.slice(0, cols)])
  }
  let x = 0
  const rects = widths.map((w, i) => {
    const out = `<rect x="${x * PX}" y="5" width="${w * PX - 2}" height="6" rx="3" fill="${color(i)}"/>`
    x += w + 1
    return out
  })
  return svg(s, key, 'turn lengths', cols, 1, rects.join(''))
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += ALPHABET[(n >> 18) & 63]
    out += ALPHABET[(n >> 12) & 63]
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '='
  }
  return out
}

function clamp(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}
