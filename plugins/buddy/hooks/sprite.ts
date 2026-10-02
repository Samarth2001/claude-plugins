// Buddy is a pixel-art mochi with a sprout on its head. Each mood is a short
// loop of frames on a 19x8 pixel grid: the body on the left (x 0-11), a prop on
// the right (x 12-18). One grid feeds both surfaces: half-block cells for the
// terminal's Raster (two pixels a cell) and crisp rects with SMIL frame swaps
// for the desktop's Svg.
//
// The sprout is the context gauge: green and upright while there is room, then
// yellow, orange, and finally brown and wilted near a full window.

import type { Mood } from '../types'

export const WIDTH = 19
export const HEIGHT = 8
export const BODY_WIDTH = 12

// The face alone (rows 3-6 of the body), for the compact band.
export const FACE = { x: 0, y: 3, width: BODY_WIDTH, height: 4 } as const

type Color = number | null
type Grid = Color[]

const OUTLINE = 0x5b4a42
const BODY = 0xf6ecdf
const SHADE = 0xe6d5c3
const SHINE = 0xffffff
const EYE = 0x2a2220
const BLUSH = 0xf2a3a0
const INK = 0x9aa3b5
const PAPER = 0xf4f1ea
const COVER = 0x8b5e3c
const GOLD = 0xf2c14e
const RED = 0xe5534b
const WATER = 0x6cc4e8
const SEA = 0x4a90d9
const LAND = 0x6bbf59
const SCREEN = 0x1f2430
const PROMPT = 0x7bc96f
const WOOD = 0xd9a066

// Leaf and stem colors by how full the context window is.
export function sprout(percent: number): { leaf: number; stem: number; isWilted: boolean } {
  if (percent >= 90) return { leaf: 0xa0663c, stem: 0x7a4b2a, isWilted: true }
  if (percent >= 75) return { leaf: 0xe8964a, stem: 0xb8702f, isWilted: false }
  if (percent >= 50) return { leaf: 0xd6c35a, stem: 0x9a8f3a, isWilted: false }
  return { leaf: 0x7bc96f, stem: 0x4e9a45, isWilted: false }
}

// Text colors that match the sprout, for the numbers beside it.
export function levelColor(percent: number): string {
  if (percent >= 90) return '#E5534B'
  if (percent >= 75) return '#E8964A'
  if (percent >= 50) return '#D6C35A'
  return '#7BC96F'
}

type Eyes = 'open' | 'blink' | 'side' | 'up' | 'happy' | 'closed' | 'cross' | 'tired'

type Pose = {
  eyes: Eyes
  isSquashed: boolean // breathing in: one row shorter, wider on top
  dx: number // a shake
  sway: boolean // the leaf leans left
}

function canvas(): Grid {
  return Array<Color>(WIDTH * HEIGHT).fill(null)
}

function put(grid: Grid, x: number, y: number, color: Color): void {
  if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) grid[y * WIDTH + x] = color
}

function row(grid: Grid, y: number, from: number, to: number, color: Color): void {
  for (let x = from; x <= to; x++) put(grid, x, y, color)
}

function body(grid: Grid, pose: Pose, percent: number): void {
  const d = pose.dx
  const { leaf, stem, isWilted } = sprout(percent)
  const top = pose.isSquashed ? 3 : 2

  // Sprout.
  if (isWilted) {
    put(grid, 6 + d, top - 1, stem)
    put(grid, 7 + d, top - 1, leaf)
    put(grid, 8 + d, top - 1, leaf)
  } else {
    put(grid, 6 + d, top - 1, stem)
    const lx = pose.sway ? 5 : 6
    put(grid, lx + d, top - 2, leaf)
    put(grid, lx + 1 + d, top - 2, leaf)
  }

  // Body: a rounded loaf, shaded underneath.
  if (pose.isSquashed) {
    row(grid, 3, 2 + d, 9 + d, OUTLINE)
  } else {
    row(grid, 2, 3 + d, 8 + d, OUTLINE)
    put(grid, 2 + d, 3, OUTLINE)
    row(grid, 3, 3 + d, 8 + d, BODY)
    put(grid, 9 + d, 3, OUTLINE)
    put(grid, 4 + d, 3, SHINE)
  }
  for (const y of [4, 5]) {
    put(grid, 1 + d, y, OUTLINE)
    row(grid, y, 2 + d, 9 + d, BODY)
    put(grid, 10 + d, y, OUTLINE)
  }
  put(grid, 1 + d, 6, OUTLINE)
  put(grid, 2 + d, 6, BLUSH)
  row(grid, 6, 3 + d, 8 + d, SHADE)
  put(grid, 9 + d, 6, BLUSH)
  put(grid, 10 + d, 6, OUTLINE)
  row(grid, 7, 2 + d, 9 + d, OUTLINE)

  eyes(grid, pose.eyes, d)
}

function eyes(grid: Grid, kind: Eyes, d: number): void {
  for (const cx of [3, 8]) {
    const x = cx + d
    switch (kind) {
      case 'open':
        put(grid, x, 4, EYE)
        put(grid, x, 5, EYE)
        break
      case 'blink':
        put(grid, x - 1, 5, EYE)
        put(grid, x, 5, EYE)
        break
      case 'side':
        put(grid, x + 1, 4, EYE)
        put(grid, x + 1, 5, EYE)
        break
      case 'up':
        put(grid, x + 1, 4, EYE)
        break
      case 'happy':
        put(grid, x - 1, 5, EYE)
        put(grid, x, 4, EYE)
        put(grid, x + 1, 5, EYE)
        break
      case 'closed':
        row(grid, 5, x - 1, x + 1, EYE)
        break
      case 'cross':
        put(grid, x - 1, 4, EYE)
        put(grid, x + 1, 4, EYE)
        put(grid, x, 5, EYE)
        put(grid, x - 1, 6, EYE)
        put(grid, x + 1, 6, EYE)
        break
      case 'tired':
        put(grid, x, 4, OUTLINE)
        put(grid, x, 5, EYE)
        break
    }
  }
}

// Props, drawn at frame f of the mood's loop.

function thoughtDots(grid: Grid, f: number): void {
  const shown = f % 4
  if (shown >= 1) put(grid, 12, 6, INK)
  if (shown >= 2) put(grid, 14, 4, INK)
  if (shown >= 3) {
    row(grid, 1, 16, 17, INK)
    row(grid, 2, 16, 17, INK)
  }
}

function book(grid: Grid, f: number): void {
  row(grid, 4, 13, 14, PAPER)
  row(grid, 4, 16, 17, PAPER)
  for (const y of [5, 6]) {
    row(grid, y, 12, 14, PAPER)
    put(grid, 15, y, COVER)
    row(grid, y, 16, 18, PAPER)
  }
  row(grid, 7, 12, 18, COVER)
  // A line of text being read, moving down the page.
  const y = f % 2 === 0 ? 5 : 6
  row(grid, y, 12, 14, INK)
  row(grid, 11 - y, 16, 18, INK)
}

function pencil(grid: Grid, f: number): void {
  const k = [0, 1, 2, 1][f % 4] ?? 0
  row(grid, 7, 12, 12 + k, INK)
  put(grid, 12 + k, 7, EYE)
  put(grid, 13 + k, 6, WOOD)
  put(grid, 14 + k, 5, GOLD)
  put(grid, 15 + k, 4, GOLD)
  put(grid, 16 + k, 3, BLUSH)
}

function terminal(grid: Grid, f: number): void {
  row(grid, 3, 12, 18, INK)
  row(grid, 7, 12, 18, INK)
  for (const y of [4, 5, 6]) {
    put(grid, 12, y, INK)
    row(grid, y, 13, 17, SCREEN)
    put(grid, 18, y, INK)
  }
  put(grid, 13, 5, PROMPT)
  const typed = f % 4
  row(grid, 5, 14, 13 + typed, PAPER)
  if (f % 2 === 0) put(grid, 14 + typed, 5, PROMPT)
}

function globe(grid: Grid, f: number): void {
  const mask = ['.sss.', 'sssss', 'sssss', 'sssss', '.sss.']
  const land = [
    [1, 1],
    [2, 1],
    [1, 2],
    [3, 2],
    [2, 3],
    [3, 3],
    [4, 3],
    [2, 4],
  ]
  mask.forEach((line, y) => [...line].forEach((ch, x) => ch === 's' && put(grid, 13 + x, 3 + y, SEA)))
  for (const [lx = 0, ly = 0] of land) {
    const x = (lx + f) % 5
    if (mask[ly]?.[x] === 's') put(grid, 13 + x, 3 + ly, LAND)
  }
}

function helper(grid: Grid, f: number): void {
  const k = [0, 1, 2, 1][f % 4] ?? 0
  const y = k % 2 === 1 ? 4 : 5
  const x = 13 + k
  row(grid, y, x + 1, x + 3, BODY)
  row(grid, y + 1, x, x + 4, BODY)
  put(grid, x + 1, y + 1, EYE)
  put(grid, x + 3, y + 1, EYE)
  row(grid, y + 2, x + 1, x + 3, OUTLINE)
}

function gear(grid: Grid, f: number): void {
  if (f % 2 === 0) {
    for (let i = -2; i <= 2; i++) {
      put(grid, 15 + i, 4, INK)
      put(grid, 15, 4 + i, INK)
    }
  } else {
    for (const i of [-2, -1, 1, 2]) {
      put(grid, 15 + i, 4 + i, INK)
      put(grid, 15 + i, 4 - i, INK)
    }
  }
  put(grid, 15, 4, GOLD)
}

function sparkles(grid: Grid, f: number): void {
  const big = (x: number, y: number) => {
    put(grid, x, y, SHINE)
    put(grid, x - 1, y, GOLD)
    put(grid, x + 1, y, GOLD)
    put(grid, x, y - 1, GOLD)
    put(grid, x, y + 1, GOLD)
  }
  if (f % 2 === 0) {
    big(14, 2)
    put(grid, 17, 6, GOLD)
    put(grid, 11, 1, GOLD)
  } else {
    big(17, 4)
    put(grid, 13, 6, GOLD)
    put(grid, 15, 1, GOLD)
  }
}

function bang(grid: Grid): void {
  for (let y = 1; y <= 4; y++) row(grid, y, 15, 16, RED)
  row(grid, 6, 15, 16, RED)
}

function zees(grid: Grid, f: number): void {
  const z = (x: number, y: number) => {
    row(grid, y, x, x + 3, INK)
    put(grid, x + 2, y + 1, INK)
    put(grid, x + 1, y + 2, INK)
    row(grid, y + 3, x, x + 3, INK)
  }
  if (f % 8 < 4) z(12, 4)
  if (f % 8 >= 2 && f % 8 < 6) z(15, 0)
}

// A firefly drifting a slow loop while buddy waits, glowing on and off.
const FLIGHT = [
  [13, 5], [14, 4], [15, 3], [16, 2], [17, 2], [18, 3], [18, 4], [17, 5],
  [16, 6], [15, 6], [14, 6], [13, 5], [13, 4], [14, 3], [15, 4], [14, 5],
]

function firefly(grid: Grid, f: number): void {
  const [x = 13, y = 5] = FLIGHT[f % FLIGHT.length] ?? []
  put(grid, x, y, f % 4 === 3 ? 0x8a7a3a : GOLD)
}

function sweat(grid: Grid, f: number): void {
  put(grid, 11, f % 2 === 0 ? 2 : 3, WATER)
  put(grid, 11, f % 2 === 0 ? 3 : 4, WATER)
}

type Loop = { frames: Grid[]; frameMs: number }

type Look = { percent: number; isSweating: boolean }

// The frames of one mood. Pure: the same inputs give the same pixels.
export function animation(mood: Mood, look: Look): Loop {
  const { percent } = look
  const pose = (eyes: Eyes, more: Partial<Pose> = {}): Pose => ({ eyes, isSquashed: false, dx: 0, sway: false, ...more })
  const frame = (p: Pose, prop?: (grid: Grid) => void, sweatFrame?: number): Grid => {
    const grid = canvas()
    body(grid, p, percent)
    prop?.(grid)
    if (look.isSweating && sweatFrame !== undefined) sweat(grid, sweatFrame)
    return grid
  }
  const loop = (count: number, frameMs: number, make: (f: number) => Grid): Loop => ({
    frames: Array.from({ length: count }, (_, f) => make(f)),
    frameMs,
  })

  switch (mood) {
    case 'idle':
      // Breathes every two seconds, the leaf leans now and then, one blink.
      return loop(16, 250, f =>
        frame(pose(f === 10 ? 'blink' : f >= 12 ? 'side' : 'open', { isSquashed: Math.floor(f / 4) % 2 === 1, sway: f >= 6 && f <= 9 }), g => firefly(g, f), f),
      )
    case 'sleeping':
      return loop(8, 500, f => frame(pose('closed', { isSquashed: f % 4 < 2 }), g => zees(g, f)))
    case 'thinking':
      return loop(4, 350, f => frame(pose('up', { isSquashed: f >= 2 }), g => thoughtDots(g, f), f))
    case 'reading':
      return loop(4, 400, f => frame(pose(f === 3 ? 'blink' : 'side'), g => book(g, f), f))
    case 'editing':
      return loop(4, 250, f => frame(pose('side'), g => pencil(g, f), f))
    case 'running':
      return loop(4, 200, f => frame(pose('side', { isSquashed: f % 2 === 1 }), g => terminal(g, f), f))
    case 'browsing':
      return loop(5, 300, f => frame(pose('side'), g => globe(g, f), f))
    case 'delegating':
      return loop(4, 300, f => frame(pose('side', { isSquashed: f % 2 === 1 }), g => helper(g, f), f))
    case 'working':
      return loop(4, 250, f => frame(pose('side'), g => gear(g, f), f))
    case 'done':
      return loop(4, 250, f => frame(pose('happy', { isSquashed: f % 2 === 1 }), g => sparkles(g, f)))
    case 'error':
      return loop(4, 120, f => frame(pose('cross', { dx: [0, 1, 0, -1][f] ?? 0 }), bang))
    case 'full':
      return loop(4, 600, f => {
        const grid = frame(pose('tired', { isSquashed: f >= 2 }))
        sweat(grid, f)
        return grid
      })
  }
}

// Terminal: two pixels per cell with half blocks. Fore is the top pixel, back
// the bottom one; an empty pixel is the terminal's own background.

const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584
const FULL = 0x2588
const SPACE = 0x20

export type Crop = { x: number; y: number; width: number; height: number }

export const WHOLE: Crop = { x: 0, y: 0, width: WIDTH, height: HEIGHT }

export function cells(grid: Grid, crop: Crop = WHOLE): string {
  const rows = Math.ceil(crop.height / 2)
  const words = new Uint32Array(crop.width * rows * 3)
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let x = crop.x; x < crop.x + crop.width; x++) {
      const top = grid[(crop.y + r * 2) * WIDTH + x] ?? null
      const bottom = r * 2 + 1 < crop.height ? (grid[(crop.y + r * 2 + 1) * WIDTH + x] ?? null) : null
      let ch = SPACE
      let fg = DEFAULT
      let bg = DEFAULT
      if (top !== null && bottom !== null) {
        ch = top === bottom ? FULL : UPPER
        fg = top
        bg = top === bottom ? DEFAULT : bottom
      } else if (top !== null) {
        ch = UPPER
        fg = top
      } else if (bottom !== null) {
        ch = LOWER
        fg = bottom
      }
      words[i++] = ch
      words[i++] = fg
      words[i++] = bg
    }
  }
  return base64(new Uint8Array(words.buffer))
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

// Desktop: every frame a group of rects (runs of one color merged), shown in
// turn by a discrete SMIL visibility loop, so it animates with no redraws.
// `color-scheme` keeps the sandboxed frame transparent on a dark app.

function rects(grid: Grid, crop: Crop): string {
  let out = ''
  for (let y = crop.y; y < crop.y + crop.height; y++) {
    let x = crop.x
    while (x < crop.x + crop.width) {
      const color = grid[y * WIDTH + x] ?? null
      let end = x + 1
      while (end < crop.x + crop.width && (grid[y * WIDTH + end] ?? null) === color) end++
      if (color !== null) {
        out += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="#${color.toString(16).padStart(6, '0')}"/>`
      }
      x = end
    }
  }
  return out
}

export function svg({ frames, frameMs }: Loop, scale: number, crop: Crop = WHOLE): string {
  const n = frames.length
  const dur = `${(n * frameMs) / 1000}s`
  const keyTimes = frames.map((_, i) => (i / n).toFixed(4)).join(';')
  const groups = frames
    .map((grid, i) => {
      const values = frames.map((_, j) => (j === i ? 'visible' : 'hidden')).join(';')
      const swap = n > 1 ? `<animate attributeName="visibility" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>` : ''
      return `<g visibility="${i === 0 ? 'visible' : 'hidden'}">${swap}${rects(grid, crop)}</g>`
    })
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}" ` +
    `width="${crop.width * scale}" height="${crop.height * scale}" shape-rendering="crispEdges" ` +
    `style="color-scheme:light dark;background:transparent">${groups}</svg>`
  )
}

export function frameAt(loop: Loop, now: number): Grid {
  const n = loop.frames.length
  return loop.frames[Math.floor(now / loop.frameMs) % n] ?? loop.frames[0] ?? canvas()
}
