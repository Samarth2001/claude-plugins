// The band above the prompt: a slim strip of the room, sixteen art pixels
// tall at two CSS pixels each. A tiny window with the day's weather on the
// left, a long sill with the cat on it, fairy lights along the top, and at
// the right the session's instruments: mugs, a strip of notes, a plant and,
// while subagents run, moths at a lamp. It sits on screen all session, so it
// moves slowly and little. Pure for its view and width; no text.

import { PAL } from './palette'
import { Layer, ditherPattern, isLit, seeded } from './pixels'
import type { Phase, Plant, RoomView, Weather } from './model'
import { NO_NOTES } from './model'
import { isMoonUp } from './sky'
import {
  CAT_KEYS,
  MINI_ASLEEP,
  MINI_HEART,
  MINI_LEGS,
  MINI_PLANE,
  MINI_SIT,
  MINI_SIT_TAIL,
  MINI_STARTLED,
  MINI_STARTLED_TAIL,
  MINI_WALK,
  MINI_ZED,
  rle,
} from './sprites'

const P = PAL

/** The band's height in art pixels. */
export const BAND_HEIGHT = 16
/** CSS pixels per art pixel. */
const SCALE = 2
/** The tiny window's size in art pixels, frame included. */
export const WINDOW_W = 15
export const WINDOW_H = 12

/** The band's width in art pixels for a band `columns` cells wide. */
export function bandWidth(columns: number): number {
  const n = Number.isFinite(columns) ? columns : 0
  return Math.min(640, Math.max(120, Math.round(n * 3.75)))
}

const draw = (rows: readonly string[], x: number, y: number, attributes = '') => new Layer().sprite(rows, CAT_KEYS, x, y).svg(attributes)

// The tiny window. Shared with the card, which passes its own prefix, so
// each document's classes and ids stay its own.

type Sky = Pick<RoomView, 'phase' | 'weather' | 'moon'>

/** The sky's colours from the top of the glass to the horizon. */
function skyStops(phase: Phase, weather: Weather): string[] {
  const clear = weather === 'clear'
  if (weather === 'fog') return phase === 'day' ? [P.dusk, P.rose, P.steel] : [P.plum, P.aubergine, P.mauve, P.dusk]
  switch (phase) {
    case 'night':
      return clear ? [P.ink, P.night, P.plum, P.sea] : weather === 'snow' ? [P.night, P.plum, P.aubergine, P.mauve] : [P.night, P.plum, P.aubergine, P.sea, P.sea]
    case 'dusk':
      return clear ? [P.plum, P.aubergine, P.mauve, P.rose, P.ember] : [P.plum, P.aubergine, P.mauve, P.dusk, P.rose]
    case 'dawn':
      return clear ? [P.sea, P.aubergine, P.dusk, P.rose, P.amber] : [P.sea, P.aubergine, P.mauve, P.dusk, P.rose]
    case 'day':
      return clear ? [P.steel, P.steel, P.mist] : weather === 'snow' ? [P.dusk, P.steel, P.mist] : [P.mauve, P.dusk, P.steel, P.steel]
  }
}

/** Which pixels of a disc four pixels across the moon lights: waxing from the right, waning from the left. */
function moonDisc(moon: number): { dx: number; dy: number; lit: boolean }[] {
  const out: { dx: number; dy: number; lit: boolean }[] = []
  const m = ((moon % 1) + 1) % 1
  const widths = [2, 4, 4, 2]
  widths.forEach((width, r) => {
    const half = width / 2
    const edge = half * Math.cos(2 * Math.PI * m)
    for (let i = 0; i < width; i += 1) {
      const dx = i - (width - 1) / 2
      const lit = m <= 0.5 ? dx + 0.5 > edge : dx - 0.5 < -edge
      out.push({ dx: Math.round(dx + 2) - 2, dy: r - 1, lit })
    }
  })
  return out
}

/** A soft round glow, its id prefixed `q`. */
const glowDef = (id: string, color: string, opacity: number) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`

/** The tiny window's motion, its classes prefixed `p`. */
export function miniWindowCss(p: string): string {
  return [
    `.${p}-rn{animation:${p}-rn 1.2s steps(6,end) infinite}`,
    `.${p}-dz{animation:${p}-dz 2.4s steps(8,end) infinite}`,
    `.${p}-sn{animation:${p}-sn 8s steps(16,end) infinite}`,
    `.${p}-sw{animation:${p}-sw 3s steps(1,end) infinite alternate}`,
    `.${p}-fg{animation:${p}-fg 48s steps(12,end) infinite alternate}`,
    `.${p}-tw{animation:${p}-tw 5s step-end infinite}`,
    `@keyframes ${p}-rn{0%{transform:translateY(-6px)}100%{transform:translateY(6px)}}`,
    `@keyframes ${p}-dz{0%{transform:translateY(-4px)}100%{transform:translateY(4px)}}`,
    `@keyframes ${p}-sn{0%{transform:translateY(-8px)}100%{transform:translateY(8px)}}`,
    `@keyframes ${p}-sw{0%{transform:translateX(0)}100%{transform:translateX(1px)}}`,
    `@keyframes ${p}-fg{0%{transform:translateX(0)}100%{transform:translateX(-12px)}}`,
    `@keyframes ${p}-tw{0%{opacity:1}60%{opacity:.35}}`,
  ].join('')
}

/** The tiny window, 15 by 12 art pixels with its top-left at (x, y): frame, sky, city and weather. */
export function miniWindow(view: Sky, x: number, y: number, p: string): string {
  const q = `q${p.slice(1)}`
  const phase = view.phase
  const weather = view.weather ?? 'rain'
  const gx = x + 1
  const gy = y + 1
  const gw = WINDOW_W - 2
  const gh = WINDOW_H - 2
  let defs = `<clipPath id="${q}gl"><rect x="${gx}" y="${gy}" width="${gw}" height="${gh}"/></clipPath>`
  // The sky, dithered from one colour to the next down the glass.
  const stops = skyStops(phase, weather)
  const rows: string[] = []
  for (let r = 0; r < gh; r += 1) {
    const t = (r / (gh - 1)) * (stops.length - 1)
    const i = Math.min(Math.floor(t), stops.length - 2)
    const level = Math.round((t - i) * 16)
    let row = ''
    for (let c = 0; c < gw; c += 1) row += String(isLit(c, r, level) ? i + 1 : i)
    rows.push(row)
  }
  const sky = new Layer().sprite(rows, Object.fromEntries(stops.map((color, i) => [String(i), color])), gx, gy)
  let lights = ''
  // The sun by day and low at dawn, the moon and stars on clear nights.
  const clear = weather === 'clear'
  if (clear && phase === 'day') {
    defs += glowDef(`${q}sun`, P.amber, 0.45)
    lights += `<circle cx="${gx + 9.5}" cy="${gy + 2.5}" r="4.5" fill="url(#${q}sun)"/>`
    lights += new Layer().rect(gx + 9, gy + 1, 1, 3, P.amber).rect(gx + 8, gy + 2, 3, 1, P.amber).dot(gx + 9, gy + 2, P.cream).svg()
    lights += new Layer().rect(gx + 1, gy + 3, 4, 1, P.cream).rect(gx + 2, gy + 2, 2, 1, P.cream).svg('opacity=".55"')
  }
  if (clear && phase === 'dawn') {
    defs += glowDef(`${q}sun`, P.amber, 0.5)
    lights += `<circle cx="${gx + 3.5}" cy="${gy + gh - 3}" r="5" fill="url(#${q}sun)"/>`
    lights += new Layer().rect(gx + 2, gy + gh - 5, 3, 1, P.amber).rect(gx + 1, gy + gh - 4, 5, 2, P.amber).dot(gx + 3, gy + gh - 4, P.cream).svg()
  }
  if (clear && phase !== 'day') {
    const stars = new Layer()
    const twinkle = new Layer()
    const at: [number, number, boolean][] = [[1, 1, false], [4, 3, true], [11, 4, false], [3, 0, false], [12, 1, true], [5, 5, false]]
    for (const [sx, sy, tw] of at) (tw ? twinkle : stars).dot(gx + sx, gy + sy, P.mist)
    lights += stars.svg('opacity=".7"') + twinkle.svg(`class="${p}-tw"`)
  }
  if (clear && isMoonUp(phase, weather, view.moon ?? 0.5)) {
    const mx = gx + 9
    const my = gy + 2
    defs += glowDef(`${q}moon`, P.cream, 0.3)
    const disc = new Layer()
    for (const { dx, dy, lit } of moonDisc(view.moon ?? 0.5)) disc.dot(mx + dx, my + dy, lit ? (dy === 2 ? P.mist : P.cream) : P.sea)
    lights += `<circle cx="${mx + 1}" cy="${my + 1}" r="5" fill="url(#${q}moon)"/>` + disc.svg()
  }
  // The city: a low far skyline, near towers with gaps between and a few
  // lit windows, capped with snow in snow. The far row is lost in fog.
  const rand = seeded(23)
  const city = new Layer()
  const lit = new Layer()
  const caps = new Layer()
  const fog = weather === 'fog'
  const tower = fog ? (phase === 'day' ? P.dusk : P.mauve) : phase === 'day' ? P.mauve : phase === 'night' ? P.ink : P.night
  const far = phase === 'day' ? P.dusk : phase === 'night' ? P.plum : P.aubergine
  const windows = fog ? 1 : phase === 'night' ? 5 : phase === 'dusk' ? 4 : phase === 'dawn' ? 2 : 0
  if (!fog) for (let c = 0; c < gw; c += 1) city.rect(gx + c, gy + gh - 2 - ((c * 5) % 3 === 0 ? 1 : 0), 1, 3, far)
  let tx = Math.floor(rand() * 2)
  let shown = 0
  while (tx < gw) {
    const width = 2 + Math.floor(rand() * 2)
    const height = 2 + Math.floor(rand() * 3)
    const top = gy + gh - height
    const span = Math.min(width, gw - tx)
    city.rect(gx + tx, top, span, height, tower)
    if (weather === 'snow') caps.rect(gx + tx, top, span, 1, P.cream)
    if (shown < windows && height > 2) {
      lit.dot(gx + tx + Math.floor(rand() * span), top + 1 + Math.floor(rand() * (height - 1)), P.amber)
      shown += 1
    }
    tx += width + 1 + Math.floor(rand() * 2)
  }
  let weatherSvg = ''
  if (weather === 'rain') {
    const streaks = [[1, 2], [4, 6], [5, 0], [9, 5], [11, 1], [2, 7], [12, 6]]
    weatherSvg = streaks
      .map(([sx = 0, sy = 0], i) => `<g class="${p}-rn" style="animation-delay:-${(i * 0.37).toFixed(2)}s">${new Layer().rect(gx + sx, gy + sy, 1, 2, P.mist).svg('opacity=".6"')}</g>`)
      .join('')
  } else if (weather === 'drizzle') {
    const drops = [[1, 3], [5, 1], [8, 6], [11, 2], [3, 7]]
    weatherSvg =
      drops.map(([sx = 0, sy = 0], i) => `<g class="${p}-dz" style="animation-delay:-${(i * 0.53).toFixed(2)}s">${new Layer().dot(gx + sx, gy + sy, P.mist).svg('opacity=".4"')}</g>`).join('') +
      new Layer().dot(gx + 2, gy + 5, P.mist).dot(gx + 10, gy + 7, P.mist).dot(gx + 7, gy + 2, P.mist).svg('opacity=".55"')
  } else if (weather === 'snow') {
    const flakes = [[1, 1], [4, 5], [6, 2], [9, 7], [11, 3], [3, 8], [10, 0]]
    weatherSvg = flakes
      .map(
        ([sx = 0, sy = 0], i) =>
          `<g class="${p}-sn" style="animation-delay:-${(i * 1.13).toFixed(2)}s"><g class="${p}-sw" style="animation-delay:-${(i * 0.7).toFixed(1)}s">${new Layer().dot(gx + sx, gy + sy, i % 2 === 0 ? P.cream : P.mist).svg()}</g></g>`,
      )
      .join('')
  } else if (weather === 'fog') {
    defs += ditherPattern(`${q}fog`, P.mist, 4)
    weatherSvg =
      `<g class="${p}-fg"><rect x="${gx}" y="${gy + 2}" width="${gw + 12}" height="3" fill="url(#${q}fog)" opacity=".45"/></g>` +
      `<g class="${p}-fg" style="animation-delay:-20s"><rect x="${gx}" y="${gy + gh - 4}" width="${gw + 12}" height="4" fill="url(#${q}fog)" opacity=".6"/></g>`
  }
  // A drift along the bottom of the glass in snow.
  if (weather === 'snow') caps.rect(gx, gy + gh - 1, gw, 1, P.mist)
  // The frame: lit top and left, shaded bottom and right, a mullion, a glint on each pane.
  const frame = new Layer()
  frame.rect(x, y, WINDOW_W, 1, P.dusk).rect(x, y, 1, WINDOW_H, P.dusk)
  frame.rect(x + 1, y + WINDOW_H - 1, WINDOW_W - 1, 1, P.aubergine).rect(x + WINDOW_W - 1, y + 1, 1, WINDOW_H - 1, P.aubergine)
  frame.rect(x + 7, gy, 1, gh, P.mauve)
  const glint = new Layer().dot(gx, gy, P.mist).dot(gx + 1, gy, P.mist).dot(gx, gy + 1, P.mist).dot(gx + 7, gy, P.mist).dot(gx + 7, gy + 1, P.mist)
  return (
    `<defs>${defs}</defs><g clip-path="url(#${q}gl)">${sky.svg()}${lights}${city.svg()}${lit.svg()}${caps.svg('opacity=".85"')}${weatherSvg}</g>` +
    frame.svg() +
    glint.svg('opacity=".18"')
  )
}

// The band itself.

const LIGHT_COLORS = [P.amber, P.cream, P.rose, P.leaf] as const

/** Fairy lights along the top from x0 to x1: a wire in shallow swags, a bulb every seven pixels. */
function fairyLights(view: RoomView, x0: number, x1: number): { defs: string; svg: string } {
  const isLit = view.phase !== 'day'
  const span = 36
  const sag = (x: number) => 1 + Math.round(1.6 * Math.sin((Math.PI * ((((x - x0) % span) + span) % span)) / span))
  const rows = ['', '', '', '']
  for (let x = 0; x < x0; x += 1) for (let r = 0; r < 4; r += 1) rows[r] += '.'
  for (let x = x0; x <= x1; x += 1) for (let r = 0; r < 4; r += 1) rows[r] += r === sag(x) ? 'w' : '.'
  const wire = new Layer().sprite(rows, { w: P.mauve }, 0, 0)
  const glows: string[] = ['', '', '', '']
  const bulbs = new Layer()
  let i = 0
  for (let x = x0 + 5; x <= x1 - 2; x += 9) {
    const n = i % LIGHT_COLORS.length
    const y = sag(x) + 1
    bulbs.dot(x, y, isLit ? (LIGHT_COLORS[n] ?? P.amber) : P.dusk)
    // Each glow breathes on its own, or while Claude works, brightens in turn along the string.
    const motion = view.isWorking ? `pb-ch pb-c${i % 12}` : `pb-g pb-g${i % 3}`
    if (isLit) glows[n] += `<circle class="${motion}" cx="${x + 0.5}" cy="${y + 0.5}" r="3"/>`
    i += 1
  }
  const defs = isLit ? LIGHT_COLORS.map((color, n) => glowDef(`qbl${n}`, color, 0.55)).join('') : ''
  const glow = glows.map((circles, n) => (circles === '' ? '' : `<g fill="url(#qbl${n})">${circles}</g>`)).join('')
  return { defs, svg: `${wire.svg('opacity=".55"')}${glow}${bulbs.svg()}` }
}

const MUG = rle(['c2tc2.', '3cdh.', '3cd.h', '3cdh.', '.2d3.'])

function mugs(turns: number, x: number): string {
  const layer = new Layer()
  const full = Math.max(0, Math.min(turns, 5))
  for (let i = 0; i < 5; i += 1) {
    const isFull = i < full
    layer.sprite(MUG, isFull ? { c: P.cream, d: P.rose, h: P.cream, t: P.rust } : { c: P.mauve, d: P.aubergine, h: P.mauve, t: P.ink }, x + i * 7, 8)
  }
  const steam = full > 0 ? `<g class="pb-sm">${new Layer().dot(x + (full - 1) * 7 + 1, 6, P.mist).dot(x + (full - 1) * 7 + 2, 5, P.mist).svg('opacity=".5"')}</g>` : ''
  return layer.svg() + steam
}

/** A strip of up to eight notes pinned on a cork board: done, then the one under way, then those waiting. */
function notes(view: RoomView, x: number, count: number): string {
  const n = view.notes ?? NO_NOTES
  const board = new Layer()
  const width = count * 3 + 2
  board.rect(x, 5, width, 6, P.umber)
  board.rect(x, 5, width, 1, P.rust).rect(x, 5, 1, 6, P.rust)
  board.rect(x + 1, 11, width - 1, 1, P.ink)
  const cork = `<rect x="${x + 1}" y="6" width="${width - 2}" height="4" fill="url(#qbck)"/>`
  const paper = new Layer()
  let active = ''
  for (let i = 0; i < count; i += 1) {
    const px = x + 2 + i * 3
    if (i < n.done) paper.rect(px, 7, 2, 2, P.leaf).rect(px, 9, 2, 1, P.moss)
    else if (i < n.done + n.active) active += new Layer().rect(px, 7, 2, 2, P.amber).rect(px, 9, 2, 1, P.ember).svg('class="pb-pu"')
    else paper.rect(px, 7, 2, 2, P.cream).rect(px, 9, 2, 1, P.rose)
  }
  return board.svg() + cork + paper.svg() + active
}

const PLANT_LEAVES: Record<Plant, readonly string[]> = {
  perky: ['l.l.l', '.lgl.', 'lgglg', '.ggg.'],
  neutral: ['5.', '.l.l.', 'lglgl', '.ggg.'],
  droopy: ['5.', '5.', '.mgm.', 'm.g.m'],
}

function plant(mood: Plant, x: number): string {
  const p = new Layer()
  p.sprite(rle(PLANT_LEAVES[mood] ?? PLANT_LEAVES.neutral), { l: P.leaf, g: P.moss, m: P.dusk }, x, 5)
  p.sprite(rle(['5k', 'kr2uk', '.kuk.', '.3k.']), { k: P.umber, r: P.ember, u: P.rust }, x, 9)
  return p.svg()
}

/** A tiny desk lamp with `count` moths fluttering about its shade. */
function lamp(count: number, x: number): { defs: string; svg: string } {
  const l = new Layer()
  l.sprite(rle(['.2ae.', '3a2e', '2.c2.', '2.m2.', '2.m2.', '2.m2.', '.3m.', '.3k.']), { k: P.umber, a: P.amber, e: P.ember, c: P.cream, m: P.dusk }, x, 5)
  const glow = `<circle cx="${x + 2.5}" cy="8" r="6.5" fill="url(#qblp)"/>`
  let moths = ''
  for (let i = 0; i < Math.min(count, 3); i += 1) {
    const moth = new Layer().dot(x + 2, 6, P.cream).svg() + `<g class="pb-wg">${new Layer().dot(x + 1, 6, P.mist).dot(x + 3, 6, P.mist).svg('opacity=".7"')}</g>`
    moths += `<g class="pb-mo pb-m${i}">${moth}</g>`
  }
  return { defs: glowDef('qblp', P.amber, 0.35), svg: glow + l.svg() + moths }
}

/**
 * The session's instruments at the right: from the edge in, the plant, the
 * notes, the mugs and the lamp. Each is kept only while it fits in `room`:
 * the plant first, then the mugs, the lamp, and as many notes as are left room for.
 */
function instruments(view: RoomView, right: number, room: number): { x: number; defs: string; svg: string } {
  const n = view.notes ?? NO_NOTES
  const total = Math.max(0, n.open) + Math.max(0, n.active) + Math.max(0, n.done)
  let left = room - 5
  const hasMugs = left >= 38
  if (hasMugs) left -= 38
  const hasLamp = view.moths > 0 && left >= 11
  if (hasLamp) left -= 11
  let count = Math.min(total, 8)
  while (count > 0 && count * 3 + 6 > left) count -= 1
  if (count < 2 && total > 1) count = 0
  let x = right - 5
  let defs = ''
  let svg = plant(view.plant, x)
  if (count > 0) {
    x -= count * 3 + 6
    svg += notes(view, x, count)
    defs += ditherPattern('qbck', P.rust, 2)
  }
  if (hasMugs) {
    x -= 38
    svg += mugs(view.turns, x)
  }
  if (hasLamp) {
    x -= 11
    const part = lamp(view.moths, x)
    defs += part.defs
    svg += part.svg
  }
  return { x, defs, svg }
}

/** The band's motion, with keyframes for this width's walk and flight. */
function bandCss(walk: number, flight: number): string {
  const pace = Math.max(walk, 1)
  const paceTime = ((pace * 0.2) / 0.45).toFixed(1)
  const chase = Array.from({ length: 12 }, (_, i) => `.pb-c${i}{animation-delay:-${(3 - i * 0.25).toFixed(2)}s}`).join('')
  return [
    '.pb-b0{animation:pb-br 4.8s step-end infinite}.pb-b1{opacity:0;animation:pb-br 4.8s step-end infinite reverse}',
    '.pb-z{opacity:0;animation:pb-z 6.6s steps(4,end) infinite}',
    `.pb-pc{animation:pb-pc ${paceTime}s steps(${pace},end) infinite}`,
    `.pb-fc{transform-box:fill-box;transform-origin:center;animation:pb-fc ${paceTime}s step-end infinite}`,
    '.pb-w{opacity:0;animation:pb-st .8s step-end infinite}.pb-w1{animation-delay:-.6s}.pb-w2{animation-delay:-.4s}.pb-w3{animation-delay:-.2s}',
    '.pb-t{opacity:0;animation:pb-tl 3.6s step-end infinite}.pb-t1{animation-delay:-2.4s}.pb-t2{animation-delay:-1.2s}',
    '.pb-bl{opacity:0;animation:pb-bl 6.2s step-end infinite}',
    '.pb-jo{animation:pb-jo 2.4s step-end forwards}.pb-af{opacity:0;animation:pb-af 2.4s step-end forwards}',
    '.pb-h{opacity:0;animation:pb-h 2.8s steps(3,end) forwards}',
    `.pb-pl{opacity:0;animation:pb-pl 4.6s steps(${Math.round(flight / 2)},end) forwards}.pb-pd{animation:pb-pd 4.6s steps(2,end) forwards}`,
    '.pb-g{animation:pb-g 7s steps(4,end) infinite}.pb-g0{animation-duration:5s}.pb-g2{animation-duration:9s;animation-delay:-3s}',
    `.pb-ch{opacity:.45;animation:pb-ch 3s step-end infinite}${chase}`,
    '.pb-pu{animation:pb-pu 3s step-end infinite}',
    '.pb-sm{opacity:0;animation:pb-sm 4s steps(3,end) infinite}',
    '.pb-mo{animation:pb-mo 2.8s step-end infinite}.pb-m1{animation-duration:3.4s;animation-delay:-1.1s}.pb-m2{animation-duration:4.1s;animation-delay:-2.3s}',
    '.pb-wg{animation:pb-br .5s step-end infinite}',
    '@keyframes pb-br{0%{opacity:1}50%{opacity:0}}',
    '@keyframes pb-z{0%{transform:translate(0,0);opacity:0}25%{opacity:.7}100%{transform:translate(2px,-3px);opacity:0}}',
    `@keyframes pb-pc{0%{transform:translateX(0)}45%{transform:translateX(${pace}px)}50%{transform:translateX(${pace}px)}95%{transform:translateX(0)}100%{transform:translateX(0)}}`,
    '@keyframes pb-fc{0%{transform:scaleX(1)}47.5%{transform:scaleX(-1)}97.5%{transform:scaleX(1)}}',
    '@keyframes pb-st{0%{opacity:1}25%{opacity:0}}',
    '@keyframes pb-tl{0%{opacity:1}33.3%{opacity:0}}',
    '@keyframes pb-bl{0%{opacity:0}96%{opacity:1}99%{opacity:0}}',
    '@keyframes pb-jo{0%{transform:translateY(0)}6%{transform:translateY(-2px)}30%{transform:translateY(0)}100%{transform:translateY(0);opacity:0}}',
    '@keyframes pb-af{0%{opacity:0}100%{opacity:1}}',
    '@keyframes pb-h{0%{opacity:0;transform:translate(0,1px)}15%{opacity:1}65%{opacity:1}100%{opacity:0;transform:translate(1px,-2px)}}',
    `@keyframes pb-pl{0%{opacity:1;transform:translateX(0)}100%{opacity:1;transform:translateX(${flight}px)}}`,
    '@keyframes pb-pd{0%{transform:translateY(0)}35%{transform:translateY(2px)}70%{transform:translateY(-1px)}100%{transform:translateY(0)}}',
    '@keyframes pb-g{0%{opacity:1}50%{opacity:.5}100%{opacity:1}}',
    '@keyframes pb-ch{0%{opacity:1}9%{opacity:.7}17%{opacity:.45}}',
    '@keyframes pb-pu{0%{opacity:1}50%{opacity:.6}}',
    '@keyframes pb-sm{0%{opacity:0;transform:translateY(0)}30%{opacity:1}100%{opacity:0;transform:translateY(-3px)}}',
    '@keyframes pb-mo{0%{transform:translate(-4px,0)}17%{transform:translate(-2px,-2px)}33%{transform:translate(1px,-3px)}50%{transform:translate(4px,-1px)}67%{transform:translate(3px,2px)}83%{transform:translate(-3px,2px)}}',
    miniWindowCss('pb'),
    '@media (prefers-reduced-motion:reduce){*{animation:none!important}.pb-b1,.pb-z,.pb-w1,.pb-w2,.pb-w3,.pb-t1,.pb-t2,.pb-bl,.pb-jo,.pb-h,.pb-pl,.pb-sm{opacity:0}.pb-ch{opacity:.8}.pb-w0,.pb-t0,.pb-af{opacity:1}}',
  ].join('')
}

/** Three hearts rising over a cat whose head is near (x, y). */
function hearts(x: number, y: number): string {
  return [-4, 1, 6]
    .map((dx, i) => `<g class="pb-h" style="animation-delay:${(i * 0.7).toFixed(1)}s">${new Layer().sprite(MINI_HEART, CAT_KEYS, x + dx, y + (i % 2)).svg()}</g>`)
    .join('')
}

/** The sitting cat at x, tail flicking, blinking now and then. */
function sitting(x: number): string {
  const y = 4
  const tails = MINI_SIT_TAIL.map((tail, i) => draw(tail, x - 4, y + 5, `class="pb-t pb-t${i}"`)).join('')
  return tails + draw(MINI_SIT, x, y) + new Layer().dot(x + 7, y + 2, P.umber).svg('class="pb-bl"')
}

/** The band's SVG for a view, sized for a band `columns` cells wide. */
export function buildBand(view: RoomView, columns: number): string {
  const w = bandWidth(columns)
  const h = BAND_HEIGHT
  const wx = 3
  // The wall and the sill: a lit top edge, a dark foot.
  const ground = new Layer()
  ground.rect(0, 0, w, h, P.night)
  ground.rect(0, 0, w, 1, P.aubergine)
  ground.rect(0, 13, w, 1, P.mauve)
  ground.rect(0, 14, w, 1, P.aubergine)
  ground.rect(0, 15, w, 1, P.ink)
  const shade = new Layer().rect(0, 1, w, 1, P.ink)
  // The sill's worn lit edge, every so often.
  const sill = new Layer()
  const grain = seeded(5)
  for (let x = 2 + Math.floor(grain() * 6); x < w; x += 7 + Math.floor(grain() * 14)) sill.rect(x, 13, 2 + Math.floor(grain() * 4), 1, P.dusk)
  const tools = instruments(view, w - 3, Math.max(0, w - 3 - (wx + WINDOW_W + 42)))
  const lights = fairyLights(view, wx + WINDOW_W + 1, w - 2)
  const sleepX = wx + WINDOW_W + 3
  const sitX = Math.max(sleepX + 4, tools.x - 16)
  const walkEnd = Math.max(sleepX, tools.x - 18)
  const flight = w + 8 - (wx + 4)
  let cat = ''
  let heartsAt: [number, number] = [sleepX + 8, 1]
  switch (view.cat) {
    case 'asleep':
    case 'stretch': {
      const [out, inn] = MINI_ASLEEP
      const cushion = new Layer().rect(sleepX - 1, 12, 16, 1, P.rose).rect(sleepX - 1, 12, 1, 1, P.mauve).rect(sleepX + 14, 12, 1, 1, P.mauve)
      cat =
        cushion.svg() +
        draw(out ?? [], sleepX, 4, 'class="pb-b0"') +
        draw(inn ?? [], sleepX, 4, 'class="pb-b1"') +
        (view.flourish === 'pet' ? '' : [0, 1].map(i => `<g class="pb-z" style="animation-delay:${(i * 3.3).toFixed(1)}s">${new Layer().sprite(MINI_ZED, { z: P.mist }, sleepX + 12, 1).svg()}</g>`).join(''))
      heartsAt = [sleepX + 8, 1]
      break
    }
    case 'pacing': {
      const legs = MINI_LEGS.map((frame, i) => draw(frame, 0, MINI_WALK.length, `class="pb-w pb-w${i}"`)).join('')
      cat =
        `<g class="pb-pc"><g transform="translate(${sleepX} 4)"><g class="pb-fc">${draw(MINI_WALK, 0, 0)}${legs}</g>` +
        `${view.flourish === 'pet' ? hearts(5, -1) : ''}</g></g>`
      break
    }
    case 'watching':
      cat = sitting(sitX)
      heartsAt = [sitX + 3, 0]
      break
    case 'startled':
      cat = `<g class="pb-jo">${draw(MINI_STARTLED_TAIL, sitX - 2, 3)}${draw(MINI_STARTLED, sitX, 4)}</g><g class="pb-af">${sitting(sitX)}</g>`
      heartsAt = [sitX + 3, 0]
      break
  }
  const pet = view.flourish === 'pet' && view.cat !== 'pacing' ? hearts(heartsAt[0], heartsAt[1]) : ''
  const plane =
    view.flourish === 'plane'
      ? `<g class="pb-pl"><g class="pb-pd">${new Layer().sprite(MINI_PLANE, { c: P.cream, s: P.steel }, wx + 4, 4).svg()}</g></g>`
      : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * SCALE}" height="${h * SCALE}" preserveAspectRatio="xMinYMid meet" shape-rendering="crispEdges">` +
    `<style>${bandCss(walkEnd - sleepX, flight)}</style>` +
    `<defs>${lights.defs}${tools.defs}</defs>` +
    ground.svg() +
    shade.svg('opacity=".5"') +
    sill.svg('opacity=".6"') +
    miniWindow(view, wx, 1, 'pb') +
    lights.svg +
    tools.svg +
    cat +
    pet +
    plane +
    `</svg>`
  )
}
