// The room card: a small framed portrait of the cat in its current pose, a
// window behind it with the day's weather and fairy lights over it after
// dark, and below it on the full card the session's instruments: a row of
// mugs that fill as turns finish, a cassette whose tape winds on with each
// turn, and a plant that perks up when tests pass and droops when they fail.
// While Claude keeps a todo list, a small cork board of notes hangs on the
// portrait's wall. Drawn on the same grid and palette as the room; pure for
// its input.

import { miniWindow, miniWindowCss, WINDOW_W } from './band'
import type { Plant, RoomView } from './model'
import { NO_NOTES } from './model'
import { PAL } from './palette'
import { Layer, ditherPattern } from './pixels'
import { ASLEEP, CAT_KEYS, HEART, SIT, SIT_TAIL, STARTLED, STARTLED_TAIL, STRETCH, WALK_BODY, WALK_LEGS, rle } from './sprites'

const P = PAL
/** CSS pixels per art pixel. */
const SCALE = 3

/** How many mugs the shelf holds. */
export const MUGS = 5

const STYLE = [
  '.pk-b0{animation:pk-br 4.8s step-end infinite}.pk-b1{opacity:0;animation:pk-br 4.8s step-end infinite reverse}',
  '.pk-w{opacity:0;animation:pk-st .64s step-end infinite}.pk-w1{animation-delay:-.48s}.pk-w2{animation-delay:-.32s}.pk-w3{animation-delay:-.16s}',
  '.pk-t{opacity:0;animation:pk-tl 2.4s step-end infinite}.pk-t1{animation-delay:-1.6s}.pk-t2{animation-delay:-.8s}',
  '.pk-h1{opacity:0}.pk-spin .pk-h0{animation:pk-br .5s step-end infinite}.pk-spin .pk-h1{animation:pk-br .5s step-end infinite reverse}',
  '.pk-g{animation:pk-g 7s steps(4,end) infinite}.pk-g0{animation-duration:5s}.pk-g2{animation-duration:9s;animation-delay:-3s}',
  '.pk-sw{animation:pk-sw 3s step-end infinite}',
  '.pk-ht{opacity:0;animation:pk-ht 3s steps(6,end) forwards}',
  '@keyframes pk-br{0%{opacity:1}50%{opacity:0}}@keyframes pk-st{0%{opacity:1}25%{opacity:0}}@keyframes pk-tl{0%{opacity:1}33.3%{opacity:0}}',
  '@keyframes pk-g{0%{opacity:1}50%{opacity:.5}100%{opacity:1}}',
  '@keyframes pk-sw{0%{transform:translateX(0)}50%{transform:translateX(1px)}}',
  '@keyframes pk-ht{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}60%{opacity:1}100%{opacity:0;transform:translate(0,-6px)}}',
  miniWindowCss('pk'),
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.pk-b1,.pk-w1,.pk-w2,.pk-w3,.pk-t1,.pk-t2,.pk-h1,.pk-ht{opacity:0}.pk-w0,.pk-t0{opacity:1}}',
].join('')

function svg(width: number, height: number, defs: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * SCALE}" height="${height * SCALE}" shape-rendering="crispEdges">` +
    `<style>${STYLE}</style><defs>${defs}</defs>${body}</svg>`
  )
}

const glowDef = (id: string, color: string, opacity: number) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`

const LIGHT_COLORS = [P.amber, P.cream, P.rose, P.leaf] as const

/** Fairy lights in two shallow swags across the top of the portrait, lit after dark. */
function fairyLights(w: number): { defs: string; svg: string } {
  const wire = new Layer()
  const half = (w - 6) / 2
  const sag = (x: number) => 2 + Math.round(2 * Math.sin((Math.PI * ((x - 3) % half)) / half))
  for (let x = 3; x < w - 3; x += 1) wire.dot(x, sag(x), P.mauve)
  const bulbs = new Layer()
  const glows: string[] = ['', '', '', '']
  let i = 0
  for (let x = 6; x < w - 4; x += 6) {
    const n = i % LIGHT_COLORS.length
    const y = sag(x) + 1
    bulbs.dot(x, y, LIGHT_COLORS[n] ?? P.amber)
    glows[n] += `<circle class="pk-g pk-g${i % 3}" cx="${x + 0.5}" cy="${y + 0.5}" r="2.5"/>`
    i += 1
  }
  return {
    defs: LIGHT_COLORS.map((color, n) => glowDef(`qkl${n}`, color, 0.5)).join(''),
    svg: wire.svg('opacity=".7"') + glows.map((c, n) => (c === '' ? '' : `<g fill="url(#qkl${n})">${c}</g>`)).join('') + bulbs.svg(),
  }
}

const PLUS = ['.k.', 'kkk', '.k.']

/** A small cork board of up to six notes: done, then the one under way, then those waiting; a `+` when there are more. */
function noteBoard(view: RoomView, x: number, y: number): string {
  const n = view.notes ?? NO_NOTES
  const total = n.done + n.active + n.open
  const board = new Layer()
  board.rect(x, y, 18, 11, P.umber)
  board.rect(x, y, 18, 1, P.rust).rect(x, y, 1, 11, P.rust)
  board.rect(x + 1, y + 11, 18, 1, P.ink).rect(x + 18, y + 1, 1, 10, P.ink)
  const cork = `<rect x="${x + 1}" y="${y + 1}" width="16" height="9" fill="url(#qkck)"/>`
  const paper = new Layer()
  let active = ''
  const slots = Math.min(total, 6)
  for (let i = 0; i < slots; i += 1) {
    const px = x + 2 + (i % 3) * 5
    const py = y + 2 + Math.floor(i / 3) * 4
    if (i === 5 && total > 6) {
      paper.sprite(PLUS, { k: P.cream }, px, py)
      continue
    }
    const pin = (layer: Layer, color: string) => layer.dot(px + 1, py, color)
    if (i < n.done) {
      paper.rect(px, py, 4, 3, P.leaf).rect(px, py + 2, 4, 1, P.moss).dot(px + 1, py + 1, P.cream).dot(px + 2, py, P.cream)
    } else if (i < n.done + n.active) {
      const note = new Layer().rect(px, py, 4, 3, P.amber).rect(px, py + 2, 4, 1, P.ember)
      pin(note, P.rust)
      active += note.svg('class="pk-sw"')
    } else {
      paper.rect(px, py, 4, 3, P.cream).rect(px, py + 2, 4, 1, P.mist).rect(px + 1, py + 1, 2, 1, P.dusk)
      pin(paper, P.rust)
    }
  }
  return board.svg() + cork + paper.svg() + active
}

/** Three hearts rising over a petted cat whose head is near (x, y). */
function hearts(x: number, y: number): string {
  return [-6, 0, 6]
    .map((dx, i) => `<g class="pk-ht" style="animation-delay:${(i * 0.6).toFixed(1)}s">${new Layer().sprite(HEART, CAT_KEYS, x + dx, y + (i === 1 ? -3 : 0)).svg()}</g>`)
    .join('')
}

/** The framed portrait, `w` by `h` art pixels at (0, 0); `withBoard` hangs the notes on its wall. */
function portrait(view: RoomView, w: number, h: number, withBoard: boolean): { defs: string; svg: string } {
  const back = new Layer()
  // The frame: a lit top and left, a shadowed bottom and right, a dark inner lip.
  back.rect(0, 0, w, h, P.mauve)
  back.rect(0, 0, w, 1, P.dusk).rect(0, 0, 1, h, P.dusk)
  back.rect(1, h - 1, w - 1, 1, P.aubergine).rect(w - 1, 1, 1, h - 1, P.aubergine)
  back.rect(1, 1, w - 2, 1, P.rose)
  back.rect(2, 2, w - 4, h - 4, P.ink)
  // Inside: the wall, a window with its sill, the floor.
  back.rect(3, 3, w - 6, h - 6, P.plum)
  const floor = h - 7
  back.rect(3, floor, w - 6, 1, P.aubergine)
  back.rect(3, floor + 1, w - 6, h - 4 - floor - 1, P.night)
  for (let x = 6; x < w - 4; x += 11) back.rect(x, floor + 3, 1, 2, P.plum)
  const wx = w - WINDOW_W - 4
  back.rect(wx - 1, 16, WINDOW_W + 2, 1, P.dusk).rect(wx - 1, 17, WINDOW_W + 2, 1, P.aubergine)
  let defs = ditherPattern('qkwp', P.aubergine, 1)
  let art = back.svg() + `<rect x="3" y="3" width="${w - 6}" height="${floor - 3}" fill="url(#qkwp)"/>` + miniWindow(view, wx, 4, 'pk')
  if (view.phase !== 'day') {
    const lights = fairyLights(w)
    defs += lights.defs
    art += lights.svg
  }
  const n = view.notes ?? NO_NOTES
  if (withBoard && n.done + n.active + n.open > 0) {
    defs += ditherPattern('qkck', P.rust, 2)
    art += noteBoard(view, 5, 8)
  }
  // On the narrow glance the cat sits a little left, clear of the window.
  const cx = w < 60 ? 20 : Math.floor(w / 2)
  let cat = ''
  let head: [number, number] = [cx + 3, floor - 20]
  switch (view.cat) {
    case 'asleep':
    case 'stretch': {
      art += new Layer().sprite(rle(['2.26r2.', '.r28r.', 'v28vv', '.v28v.']), { r: P.rose, v: P.mauve }, cx - 16, floor - 3).svg()
      if (view.cat === 'stretch') cat = new Layer().sprite(STRETCH, CAT_KEYS, cx - 14, floor - 15).svg()
      else {
        const [out, inn] = ASLEEP
        cat =
          `<g class="pk-b0">${new Layer().sprite(out ?? [], CAT_KEYS, cx - 12, floor - 13).svg()}</g>` +
          `<g class="pk-b1">${new Layer().sprite(inn ?? [], CAT_KEYS, cx - 12, floor - 13).svg()}</g>`
      }
      head = [cx + 3, floor - 21]
      break
    }
    case 'pacing': {
      const top = floor + 2 - (WALK_BODY.length + 3)
      cat =
        new Layer().sprite(WALK_BODY, CAT_KEYS, cx - 14, top).svg() +
        WALK_LEGS.map((legs, i) => `<g class="pk-w pk-w${i}">${new Layer().sprite(legs, CAT_KEYS, cx - 14, top + WALK_BODY.length - 1).svg()}</g>`).join('')
      head = [cx + 5, top - 8]
      break
    }
    case 'watching': {
      const y = floor + 2 - SIT.length
      cat =
        SIT_TAIL.map((tail, i) => `<g class="pk-t pk-t${i}">${new Layer().sprite(tail, CAT_KEYS, cx - 15, y + SIT.length - 7).svg()}</g>`).join('') +
        new Layer().sprite(SIT, CAT_KEYS, cx - 9, y).svg()
      head = [cx - 1, y - 8]
      break
    }
    case 'startled': {
      const y = floor + 2 - STARTLED.length
      cat = new Layer().sprite(STARTLED_TAIL, CAT_KEYS, cx - 12, y + 3).svg() + new Layer().sprite(STARTLED, CAT_KEYS, cx - 9, y).svg()
      head = [cx - 1, y - 6]
      break
    }
  }
  const pet = view.flourish === 'pet' ? hearts(head[0], Math.max(4, head[1])) : ''
  return { defs, svg: art + cat + pet }
}

const MUG = rle(['k4tk2.', 'k4c2k.', 'k4ck.k', 'k4c2k.', 'k4ck2.', '.4k3.'])

function mugs(turns: number, x: number, y: number): string {
  const layer = new Layer()
  const full = Math.max(0, Math.min(turns, MUGS))
  for (let i = 0; i < MUGS; i += 1) {
    const isFull = i < full
    layer.sprite(MUG, isFull ? { k: P.umber, c: P.cream, t: P.rust } : { k: P.aubergine, c: P.mauve, t: P.ink }, x + i * 8, y)
  }
  // Steam over the newest mug.
  const steam = full > 0 ? new Layer().rect(x + (full - 1) * 8 + 2, y - 2, 1, 1, P.mist).rect(x + (full - 1) * 8 + 3, y - 3, 1, 1, P.mist).svg('opacity=".7"') : ''
  return layer.svg() + steam
}

/** The cassette: the left reel's tape winds onto the right as turns go by. */
function cassette(turns: number, isWorking: boolean, x: number, y: number): string {
  const c = new Layer()
  c.rect(x, y, 20, 12, P.mauve)
  c.rect(x, y, 20, 1, P.dusk).rect(x, y, 1, 12, P.dusk)
  c.rect(x, y + 11, 20, 1, P.aubergine).rect(x + 19, y + 1, 1, 11, P.aubergine)
  c.rect(x + 2, y + 2, 16, 2, P.cream)
  c.rect(x + 3, y + 2, 5, 1, P.rose)
  c.rect(x + 10, y + 3, 6, 1, P.mist)
  c.rect(x + 3, y + 5, 14, 5, P.ink)
  c.rect(x + 6, y + 10, 8, 2, P.aubergine)
  c.dot(x + 7, y + 11, P.ink).dot(x + 12, y + 11, P.ink)
  const step = Math.max(0, turns) % 9
  const left = 2 - Math.floor((step * 3) / 9)
  const right = Math.floor((step * 3) / 9)
  const reel = (cx: number, radius: number) => c.rect(cx - radius, y + 7 - radius, radius * 2 + 1, radius * 2 + 1, P.umber)
  reel(x + 6, left)
  reel(x + 14, right)
  const hubs = (frame: 0 | 1) => {
    const h = new Layer()
    for (const cx of [x + 6, x + 14]) {
      if (frame === 0) h.rect(cx - 1, y + 7, 3, 1, P.cream).rect(cx, y + 6, 1, 3, P.cream)
      else h.rect(cx - 1, y + 6, 1, 1, P.cream).rect(cx + 1, y + 6, 1, 1, P.cream).rect(cx, y + 7, 1, 1, P.cream).rect(cx - 1, y + 8, 1, 1, P.cream).rect(cx + 1, y + 8, 1, 1, P.cream)
    }
    return h.svg(`class="pk-h${frame}"`)
  }
  return `<g${isWorking ? ' class="pk-spin"' : ''}>${c.svg()}${hubs(0)}${hubs(1)}</g>`
}

const PLANTS: Record<Plant, readonly string[]> = {
  perky: ['l3.l2.l', '.l.lgl.l', '2.lglgl.', 'l.2glgl.', '.l2g2l2.', '2.lgl3.'],
  neutral: ['8.', '3.l4.', '.l.lgl2.', 'l2gl.gl.', '.lg2lg2.', '2.lglg2.'],
  droopy: ['8.', '8.', '3.2m3.', '.2m2gm2.', 'm.mgm.2m', 'm2.m2.m.'],
}

function plant(mood: Plant, x: number, y: number): string {
  const p = new Layer()
  p.sprite(rle(PLANTS[mood] ?? PLANTS.neutral), { l: P.leaf, g: P.moss, m: P.dusk }, x + 1, y)
  p.sprite(rle(['k8k', '.kr5uk.', '.kr5uk.', '2.5k2.']), { k: P.umber, r: P.rust, u: P.umber }, x, y + 6)
  p.rect(x + 1, y + 6, 8, 1, P.ember)
  return p.svg()
}

/** The shelf the instruments stand on: a lit top edge, a shadow under. */
function shelf(w: number, y: number): string {
  return new Layer().rect(1, y, w - 2, 1, P.rust).rect(1, y + 1, w - 2, 1, P.umber).rect(2, y + 2, w - 3, 1, P.ink).svg()
}

/** The whole card: portrait over the instruments on their shelf. */
export function buildCard(view: RoomView): string {
  const w = 76
  const art = portrait(view, w, 40, true)
  return svg(w, 60, art.defs, art.svg + mugs(view.turns, 2, 50) + cassette(view.turns, view.isWorking, 44, 44) + plant(view.plant, 66, 46) + shelf(w, 56))
}

/** The glance a widget shows: the portrait alone. */
export function buildGlance(view: RoomView): string {
  const art = portrait(view, 48, 34, false)
  return svg(48, 34, art.defs, art.svg)
}
