// The card's tiny window, 15 by 12 art pixels: its frame, a dithered sky
// for the time of day, a small city and the day's weather, with the sun by
// day and the moon and stars on clear nights. Each caller passes its own
// class prefix, so a document's classes and ids stay its own. Pure for its
// input.

import { PAL } from './palette'
import { Layer, ditherPattern, isLit, seeded } from './pixels'
import type { Phase, RoomView, Weather } from './model'
import { isMoonUp } from './sky'

const P = PAL

/** The tiny window's size in art pixels, frame included. */
export const WINDOW_W = 15
export const WINDOW_H = 12

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
