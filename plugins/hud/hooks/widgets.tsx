// Small graphics, one per idea. Charts are grids of colored character cells:
// the terminal paints a grid as one Raster, the desktop and the editor as runs
// of colored Text. The desktop and the editor draw icons, meters and charts as
// vectors instead: their text isn't monospaced, so cells wouldn't line up.

import type { ElementTable, RenderElement } from 'claude-code'

import { clamp, heat } from './calc'

// `now` is the drawing's clock: vectors start their loops where they would be
// by then, since the host may load a drawing afresh on each redraw.
export type Surface = { ui: ElementTable; isTerminal: boolean; now?: number }

export const ACCENT = '#B4A7F5'
export const BLUE = '#7FB2F0'
export const TRACK = '#3D4350'
const DEFAULT = 0x01000000

const hex = (color: string) => parseInt(color.slice(1), 16)

// Mixes two #rrggbb colors; t 0 is a, 1 is b.
export function mix(a: string, b: string, t: number): string {
  const x = hex(a)
  const y = hex(b)
  const c = (shift: number) => Math.round(((x >> shift) & 255) * (1 - t) + ((y >> shift) & 255) * t)
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`
}

// One cell: [char, fg, bg].
export type Cell = [string, string | null, string | null]

// Draws a grid of cells the way the surface draws best.
export function cells(s: Surface, key: string, grid: Cell[][]): RenderElement {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  if (s.isTerminal) {
    const { Raster } = s.ui as ElementTable<'terminal'>
    const words = new Uint32Array(rows * columns * 3)
    let i = 0
    for (const row of grid) {
      for (const [ch, fg, bg] of row) {
        words[i++] = ch.codePointAt(0) ?? 32
        words[i++] = fg ? hex(fg) : DEFAULT
        words[i++] = bg ? hex(bg) : DEFAULT
      }
    }
    return <Raster key={key} columns={columns} rows={rows} cells={base64(new Uint8Array(words.buffer))} />
  }
  // Elsewhere: each row as runs of same-colored Text.
  const { Box, Text } = s.ui
  return (
    <Box key={key} flexDirection="column" flexShrink={0}>
      {grid.map((row, r) => {
        const runs: { text: string; fg: string | null; bg: string | null }[] = []
        for (const [ch, fg, bg] of row) {
          const last = runs.at(-1)
          if (last && last.fg === fg && last.bg === bg) last.text += ch
          else runs.push({ text: ch, fg, bg })
        }
        return (
          <Box key={`${key}-${r}`} flexShrink={0}>
            {runs.map((run, i) => (
              <Text key={`${key}-${r}-${i}`} color={run.fg ?? undefined} backgroundColor={run.bg ?? undefined}>{run.text}</Text>
            ))}
          </Box>
        )
      })}
    </Box>
  )
}

// A capsule meter of segments: heat-colored up to `percent`, the track after
// it, and, when `mark` is ahead of the fill, the segment where an even pace
// would be by now drawn as a bright notch. Segments read the same in the
// terminal and in the desktop's code font, where a ruled line draws hairline-thin.
export function bar(s: Surface, key: string, percent: number, cols: number, mark?: number, track = TRACK, bg: string | null = null): RenderElement {
  if (!s.isTerminal) return capsule(s, key, percent, cols, mark)
  return cells(s, key, [meterCells(percent, cols, mark, track).map(([ch, fg]): Cell => [ch, fg, bg])])
}

export function meterCells(percent: number, cols: number, mark?: number, track = TRACK): Cell[] {
  const filled = (clamp(percent) / 100) * cols
  const markAt = mark === undefined ? -1 : Math.min(cols - 1, Math.floor((clamp(mark) / 100) * cols))
  const row: Cell[] = []
  for (let i = 0; i < cols; i++) {
    // A sliver of fill still lights its segment, so 1% never reads as empty.
    const isOn = i < Math.floor(filled) || (i < filled && (filled - i >= 0.35 || i === 0))
    let cell: Cell = isOn ? ['▰', heat(((i + 0.5) / cols) * 100), null] : ['▰', track, null]
    // Behind the fill the notch isn't needed: being ahead of pace shows in the color.
    if (i === markAt && !isOn) cell = ['▮', ACCENT, null]
    row.push(cell)
  }
  return row
}

// Columns for a series, `rows` tall; the last one is "now", in the accent.
// Off the terminal the `labels` are drawn under the bars.
export function columns(s: Surface, key: string, values: number[], width: number, gap: number, rows: number, labels?: string[]): RenderElement {
  if (!s.isTerminal) return barsVector(s, key, values, values.length * (width + gap), rows, labels)
  const peak = Math.max(...values, 0)
  const levels = ' ▁▂▃▄▅▆▇█'
  const grid: Cell[][] = Array.from({ length: rows }, () => [])
  values.forEach((v, i) => {
    const color = i === values.length - 1 ? ACCENT : BLUE
    let level = peak > 0 ? Math.round((v / peak) * rows * 8) : 0
    if (v > 0 && level === 0) level = 1
    for (let r = rows - 1; r >= 0; r--) {
      const here = Math.min(8, level)
      level -= here
      // An empty period still shows as a baseline, so the chart keeps its shape.
      const isBase = here === 0 && r === rows - 1
      const ch = isBase ? '▁' : (levels[here] ?? ' ')
      for (let k = 0; k < width; k++) grid[r]?.push([ch, isBase ? TRACK : color, null])
      if (i < values.length - 1) for (let k = 0; k < gap; k++) grid[r]?.push([' ', null, null])
    }
  })
  return cells(s, key, grid)
}

// A history, 0-100 each, as heat-colored eighths; only the readings there are.
export function spark(s: Surface, key: string, values: number[], cols: number): RenderElement {
  if (!s.isTerminal) return sparkVector(s, key, values, cols)
  const levels = '▁▂▃▄▅▆▇█'
  const row: Cell[] = values.slice(-cols).map(v => [levels[Math.min(7, Math.round((clamp(v) / 100) * 7))] ?? '▁', heat(v), null])
  return cells(s, key, [row.length ? row : [['▁', TRACK, null]]])
}

// Turns side by side, each as wide as it was long; an interrupted one orange.
export function timeline(s: Surface, key: string, turns: { ms: number; isAborted: boolean }[], cols: number): RenderElement {
  if (!s.isTerminal) return timelineVector(s, key, turns, cols)
  const shown = turns.slice(-Math.max(1, Math.floor(cols / 2)))
  const total = shown.reduce((a, t) => a + t.ms, 0) || 1
  const room = cols - (shown.length - 1)
  const widths = shown.map(t => Math.max(1, Math.round((t.ms / total) * room)))
  const color = (i: number) => (shown[i]?.isAborted ? '#E8964A' : i === shown.length - 1 ? ACCENT : i % 2 ? BLUE : mix(BLUE, '#3E6FB0', 0.5))
  const row: Cell[] = []
  widths.forEach((w, i) => {
    for (let k = 0; k < w; k++) row.push(['━', color(i), null])
    if (i < widths.length - 1) row.push([' ', null, null])
  })
  while (row.length < cols) row.push(['━', TRACK, null])
  return cells(s, key, [row.slice(0, cols)])
}

// ---- Vector pieces for the desktop and the editor ----------------------------
//
// Drawn as plain images with a transparent background, so they sit on whatever
// the host paints behind the band or the pane. Motion is SMIL inside the
// drawing. The host may load a drawing afresh on every redraw, which would
// restart each loop from its first frame, so every loop begins at the phase
// the clock says it has reached and keeps turning across reloads. Every
// attribute appears once per element: a duplicate makes the markup invalid and
// the host draws a broken image.

export const PX = 8 // desktop pixels per cell
export const ROW_PX = 16
// Text and tracks drawn inside a vector: neutral on a light or a dark theme.
const INK = '#8B8F98'
const FONT = 'font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="10"'

function vector(s: Surface, key: string, alt: string, w: number, tall: number, body: string): RenderElement {
  const { Box, Svg } = s.ui as ElementTable<'desktop'>
  const seconds = (s.now ?? 0) / 1000
  const phased = body
    .replace(/\n\s*/g, '')
    .replace(/dur="([\d.]+)s" repeatCount="indefinite"/g, (_, dur: string) =>
      `dur="${dur}s" repeatCount="indefinite" begin="-${(seconds % Number(dur)).toFixed(2)}s"`)
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${tall}" viewBox="0 0 ${w} ${tall}">${phased}</svg>`
  return (
    <Box key={key} flexShrink={0}>
      <Svg source={source} alt={alt} width={w} height={tall} />
    </Box>
  )
}

export type IconKind = 'idle' | 'working' | 'context' | 'five_hour' | 'seven_day' | 'tokens' | 'cost'

const lineAttrs = (color: string, width = 1.4) =>
  `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`

// A 16px tile in the chip's hue, lit from the top, with a line glyph on it;
// some of the glyphs are alive.
export function icon(s: Surface, kind: IconKind, color: string, percent = 0): RenderElement {
  const stroke = lineAttrs(color)
  const tile = `<defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.30"/><stop offset="1" stop-color="${color}" stop-opacity="0.12"/></linearGradient></defs>
    <rect x="0.5" y="0.5" width="15" height="15" rx="4.5" fill="url(#tile)" stroke="${color}" stroke-opacity="0.32"/>
    <path d="M4.5 1.25h7" stroke="#FFFFFF" stroke-opacity="0.22" stroke-linecap="round"/>`
  let glyph = ''
  switch (kind) {
    case 'idle':
      // A resting dot that breathes.
      glyph = `<circle cx="8" cy="8" r="4" ${stroke} stroke-opacity="0.4"/>
        <circle cx="8" cy="8" r="1.9" fill="${color}"><animate attributeName="r" values="1.5;2.3;1.5" dur="3.2s" repeatCount="indefinite"/></circle>`
      break
    case 'working':
      // An arc chasing its tail around a glowing core.
      glyph = `<circle cx="8" cy="8" r="4" ${stroke} stroke-opacity="0.25"/>
        <path d="M8 4a4 4 0 0 1 4 4" ${lineAttrs(color, 1.8)}><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite"/></path>
        <circle cx="8" cy="8" r="1.3" fill="${color}"><animate attributeName="opacity" values="0.4;1;0.4" dur="0.9s" repeatCount="indefinite"/></circle>`
      break
    case 'context': {
      // A pie filling with the window.
      const p = clamp(percent) / 100
      const a = p * 2 * Math.PI
      const x = 8 + 4 * Math.sin(a)
      const y = 8 - 4 * Math.cos(a)
      const slice = p >= 0.999 ? `<circle cx="8" cy="8" r="4" fill="${color}"/>` : p <= 0 ? '' :
        `<path d="M8 8V4A4 4 0 ${p > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z" fill="${color}"/>`
      glyph = `<circle cx="8" cy="8" r="4" ${stroke} stroke-opacity="0.55"/>${slice}`
      break
    }
    case 'five_hour':
      // A clock whose hand sweeps.
      glyph = `<circle cx="8" cy="8" r="4.3" ${stroke}/>
        <path d="M8 8V5.4" ${stroke}><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="12s" repeatCount="indefinite"/></path>
        <path d="M8 8l1.6 1" ${stroke}/>`
      break
    case 'seven_day':
      // A calendar page, today's square lit.
      glyph = `<rect x="4" y="4.6" width="8" height="7.4" rx="1.6" ${stroke}/><path d="M4 7h8M6 3.6v1.8M10 3.6v1.8" ${stroke}/>
        <rect x="8.6" y="8.4" width="1.8" height="1.8" rx="0.5" fill="${color}"><animate attributeName="opacity" values="1;0.35;1" dur="2.6s" repeatCount="indefinite"/></rect>`
      break
    case 'tokens':
      // Two arrows trading places.
      glyph = `<path d="M6 11.5v-7M4.4 6.1 6 4.5l1.6 1.6" ${stroke}/><path d="M10 4.5v7M8.4 9.9 10 11.5l1.6-1.6" ${stroke}/>`
      break
    case 'cost':
      // A coin with a glint passing over it.
      glyph = `<defs><clipPath id="coin"><circle cx="8" cy="8" r="4.4"/></clipPath></defs>
        <circle cx="8" cy="8" r="4.4" ${stroke}/>
        <path d="M9.4 6.5c-.35-.4-.85-.6-1.4-.6-.85 0-1.4.4-1.4 1 0 1.4 2.8.7 2.8 2.1 0 .6-.6 1-1.4 1-.6 0-1.1-.2-1.5-.6M8 5v.9M8 10.1v.9" ${lineAttrs(color, 1.1)}/>
        <g clip-path="url(#coin)"><rect x="-4" y="2" width="2.2" height="12" fill="#FFFFFF" fill-opacity="0.35" transform="skewX(-20)">
        <animate attributeName="x" values="-4;20;20" keyTimes="0;0.35;1" dur="4s" repeatCount="indefinite"/></rect></g>`
      break
  }
  return vector(s, `icon-${kind}`, kind, 16, ROW_PX, tile + glyph)
}

// Room for an icon where a row has none, so the rows still line up.
export function iconSpace(s: Surface, key: string): RenderElement {
  return vector(s, key, '', 16, ROW_PX, '')
}

const heatStops = () => [0, 55, 80, 98].map(p => `<stop offset="${p / 100}" stop-color="${heat(p)}"/>`).join('')
const SPLINE = 'calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"'
// How long a meter takes to slide to a new reading.
export const SLIDE_MS = 900

// A rounded capsule meter: a heat gradient up to `percent` on a soft track,
// and a notch where an even pace would be. `from` slides the fill in from
// there, `elapsed` ms into the slide.
export function capsule(s: Surface, key: string, percent: number, cols: number, mark?: number, from?: number, elapsed = 0): RenderElement {
  const w = cols * PX
  const tall = ROW_PX
  const h = 4
  const y = (tall - h) / 2
  const fill = Math.max(percent > 0 ? h : 0, (clamp(percent) / 100) * w)
  const start = from === undefined ? fill : Math.max(0, (clamp(from) / 100) * w)
  const slide = start === fill || elapsed >= SLIDE_MS ? '' :
    `<animate attributeName="width" from="${start.toFixed(1)}" to="${fill.toFixed(1)}" dur="${SLIDE_MS / 1000}s" begin="-${(elapsed / 1000).toFixed(2)}s" fill="freeze" ${SPLINE}/>`
  const x = mark === undefined ? undefined : (clamp(mark) / 100) * w
  // Behind the fill the notch isn't needed: being ahead of pace shows in the color.
  const notch = x === undefined || x <= fill ? '' :
    `<rect x="${Math.max(0, Math.min(w - 2, x - 1)).toFixed(1)}" y="${y - 3}" width="2" height="${h + 6}" rx="1" fill="${ACCENT}"/>`
  return vector(s, key, `${Math.round(percent)}%`, w, tall, `
    <defs><linearGradient id="heat" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0">${heatStops()}</linearGradient>
    <clipPath id="cap"><rect x="0" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>
    <rect x="0" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${INK}" fill-opacity="0.22"/>
    <g clip-path="url(#cap)"><rect x="0" y="${y}" width="${fill.toFixed(1)}" height="${h}" rx="${h / 2}" fill="url(#heat)">${slide}</rect></g>
    ${notch}`)
}

// A heartbeat trace scrolling left forever, fading in from the left.
export function heartbeat(s: Surface, cols: number, color: string): RenderElement {
  const w = cols * PX
  const tall = ROW_PX
  const mid = tall / 2 + 1
  const beat = (x: number) => `M${x} ${mid}h6l2 -6l3 11l2.5 -9l1.5 4h9`
  const path = Array.from({ length: Math.ceil(w / 24) + 2 }, (_, i) => beat(i * 24)).join('')
  return vector(s, 'heartbeat', 'working', w, tall, `
    <defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
    <path d="${path}" fill="none" stroke="url(#fade)" stroke-width="1.5" stroke-linejoin="round">
      <animateTransform attributeName="transform" type="translate" from="0 0" to="-24 0" dur="1.2s" repeatCount="indefinite"/></path>`)
}

// Bars for a series, rounded on top; the last one is "now", in
// the accent. Labels sit centered under their bars in the same drawing, so they
// can't drift from the bars the way text beside an image would.
function barsVector(s: Surface, key: string, values: number[], cols: number, rows: number, labels?: string[]): RenderElement {
  const w = cols * PX
  const labelH = labels ? 14 : 0
  const chartH = rows * ROW_PX
  const tall = chartH + labelH
  const peak = Math.max(...values, 0)
  const slot = w / Math.max(1, values.length)
  const barW = Math.max(2, Math.min(18, slot * 0.62))
  const out: string[] = []
  values.forEach((v, i) => {
    const cx = slot * i + slot / 2
    const x = (cx - barW / 2).toFixed(1)
    const isNow = i === values.length - 1
    const h = peak > 0 && v > 0 ? Math.max(2, (v / peak) * (chartH - 2)) : 0
    if (h === 0) {
      // An empty period still shows as a baseline, so the chart keeps its shape.
      out.push(`<rect x="${x}" y="${chartH - 2}" width="${barW.toFixed(1)}" height="2" rx="1" fill="${INK}" fill-opacity="0.3"/>`)
    } else {
      const y = chartH - h
      const r = Math.min(3, barW / 2, h / 2)
      out.push(`<rect x="${x}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" fill="${isNow ? ACCENT : BLUE}" fill-opacity="${isNow ? 1 : 0.6}"/>`)
    }
    const text = labels?.[i]
    if (text) {
      // A label too wide to center on its bar keeps inside the drawing's edge.
      const half = text.length * 3
      const [at, anchor] = cx < half ? [0, 'start'] : cx > w - half ? [w, 'end'] : [cx, 'middle']
      out.push(`<text x="${at.toFixed(1)}" y="${tall - 2}" text-anchor="${anchor}" ${FONT} fill="${isNow ? ACCENT : INK}">${escapeXml(text)}</text>`)
    }
  })
  return vector(s, key, 'spend per period', w, tall, out.join(''))
}

// A history, 0-100 each, as a soft area under a line, ending on a dot.
function sparkVector(s: Surface, key: string, values: number[], cols: number): RenderElement {
  const w = cols * PX
  const tall = ROW_PX
  const shown = values.slice(-Math.max(2, cols))
  const step = shown.length > 1 ? (w - 4) / (shown.length - 1) : 0
  const pts = shown.map((v, i) => [2 + i * step, tall - 2 - (clamp(v) / 100) * (tall - 4)] as const)
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  const [lx, ly] = pts.at(-1) ?? [2, tall - 2]
  const color = heat(shown.at(-1) ?? 0)
  return vector(s, key, 'context per turn', w, tall, `
    <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${path}L${lx.toFixed(1)} ${tall}L2 ${tall}Z" fill="url(#area)"/>
    <path d="${path}" ${lineAttrs(color)}/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2" fill="${color}"/>`)
}

// Turns side by side as rounded segments, each as wide as it took.
function timelineVector(s: Surface, key: string, turns: { ms: number; isAborted: boolean }[], cols: number): RenderElement {
  const w = cols * PX
  const tall = ROW_PX
  const shown = turns.slice(-Math.max(1, Math.floor(cols / 2)))
  const gap = 2
  const total = shown.reduce((a, t) => a + t.ms, 0) || 1
  const room = w - gap * (shown.length - 1)
  let x = 0
  const out = shown.map((t, i) => {
    const seg = Math.max(3, (t.ms / total) * room)
    const isLast = i === shown.length - 1
    const color = t.isAborted ? '#E8964A' : isLast ? ACCENT : BLUE
    const rect = `<rect x="${x.toFixed(1)}" y="${tall / 2 - 2}" width="${seg.toFixed(1)}" height="4" rx="2" fill="${color}" fill-opacity="${isLast || t.isAborted ? 1 : 0.55}"/>`
    x += seg + gap
    return rect
  })
  return vector(s, key, 'turn lengths', w, tall, out.join(''))
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

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

