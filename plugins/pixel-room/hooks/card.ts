// The room card: a small framed portrait of the cat in its current pose and,
// below it on the full card, three tiny instruments for the session: a row of
// mugs that fill as turns finish, a cassette whose tape winds on with each
// turn, and a plant that perks up when tests pass and droops when they fail.
// Drawn on the same grid and palette as the room; pure for its input.

import { PAL } from './palette'
import { Layer } from './pixels'
import type { Cat, Phase } from './room'
import { ASLEEP, CAT_KEYS, SIT, SIT_TAIL, STARTLED, STARTLED_TAIL, STRETCH, WALK_BODY, WALK_LEGS, rle } from './sprites'

const P = PAL
/** CSS pixels per art pixel. */
const SCALE = 3

export type Plant = 'perky' | 'neutral' | 'droopy'

/** What the card shows. */
export type CardView = { cat: Cat; phase: Phase; turns: number; plant: Plant; isWorking: boolean }

/** How many mugs the shelf holds. */
export const MUGS = 5

const STYLE =
  '.c-b0{animation:c-br 4.8s step-end infinite}.c-b1{opacity:0;animation:c-br 4.8s step-end infinite reverse}' +
  '.c-w{opacity:0;animation:c-st .64s step-end infinite}.c-w1{animation-delay:-.48s}.c-w2{animation-delay:-.32s}.c-w3{animation-delay:-.16s}' +
  '.c-t{opacity:0;animation:c-tl 2.4s step-end infinite}.c-t1{animation-delay:-1.6s}.c-t2{animation-delay:-.8s}' +
  '.c-h1{opacity:0}.c-spin .c-h0{animation:c-br .5s step-end infinite}.c-spin .c-h1{animation:c-br .5s step-end infinite reverse}' +
  '@keyframes c-br{0%{opacity:1}50%{opacity:0}}@keyframes c-st{0%{opacity:1}25%{opacity:0}}@keyframes c-tl{0%{opacity:1}33.3%{opacity:0}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.c-b1,.c-w1,.c-w2,.c-w3,.c-t1,.c-t2,.c-h1{opacity:0}.c-w0,.c-t0{opacity:1}}'

function svg(width: number, height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * SCALE}" height="${height * SCALE}" shape-rendering="crispEdges">` +
    `<style>${STYLE}</style>${body}</svg>`
  )
}

/** The framed portrait, `w` by `h` art pixels at (0, 0). */
function portrait(view: CardView, w: number, h: number): string {
  const back = new Layer()
  // The frame: a lit top and left, a shadowed bottom and right.
  back.rect(0, 0, w, h, P.mauve)
  back.rect(0, 0, w, 1, P.dusk)
  back.rect(0, 0, 1, h, P.dusk)
  back.rect(0, h - 1, w, 1, P.aubergine)
  back.rect(w - 1, 0, 1, h, P.aubergine)
  // Inside: the wall, a sliver of rainy window, the floor.
  back.rect(2, 2, w - 4, h - 4, P.plum)
  const pane = view.phase === 'night' ? P.sea : view.phase === 'dusk' ? P.rose : P.steel
  back.rect(w - 14, 4, 9, 12, P.mauve)
  back.rect(w - 13, 5, 7, 10, pane)
  back.rect(w - 10, 5, 1, 10, P.mauve)
  for (const [x, y] of [[w - 12, 7], [w - 8, 9], [w - 12, 12], [w - 7, 13], [w - 8, 6]] as const) back.rect(x, y, 1, 2, P.mist)
  back.rect(2, h - 7, w - 4, 1, P.aubergine)
  back.rect(2, h - 6, w - 4, 4, P.night)
  const floor = h - 7
  const cx = Math.floor(w / 2)
  let cat = ''
  switch (view.cat) {
    case 'asleep':
    case 'stretch': {
      back.sprite(rle(['2.26r2.', '.r28r.', 'v28vv', '.v28v.']), { r: P.rose, v: P.mauve }, cx - 16, floor - 3)
      if (view.cat === 'stretch') cat = new Layer().sprite(STRETCH, CAT_KEYS, cx - 14, floor - 15).svg()
      else {
        const [out, inn] = ASLEEP
        cat =
          `<g class="c-b0">${new Layer().sprite(out ?? [], CAT_KEYS, cx - 12, floor - 13).svg()}</g>` +
          `<g class="c-b1">${new Layer().sprite(inn ?? [], CAT_KEYS, cx - 12, floor - 13).svg()}</g>`
      }
      break
    }
    case 'pacing': {
      const top = floor + 2 - (WALK_BODY.length + 3)
      cat =
        new Layer().sprite(WALK_BODY, CAT_KEYS, cx - 14, top).svg() +
        WALK_LEGS.map((legs, i) => `<g class="c-w c-w${i}">${new Layer().sprite(legs, CAT_KEYS, cx - 14, top + WALK_BODY.length - 1).svg()}</g>`).join('')
      break
    }
    case 'watching': {
      const y = floor + 2 - SIT.length
      cat =
        SIT_TAIL.map((tail, i) => `<g class="c-t c-t${i}">${new Layer().sprite(tail, CAT_KEYS, cx - 15, y + SIT.length - 7).svg()}</g>`).join('') +
        new Layer().sprite(SIT, CAT_KEYS, cx - 9, y).svg()
      break
    }
    case 'startled': {
      const y = floor + 2 - STARTLED.length
      cat = new Layer().sprite(STARTLED_TAIL, CAT_KEYS, cx - 12, y + 3).svg() + new Layer().sprite(STARTLED, CAT_KEYS, cx - 9, y).svg()
      break
    }
  }
  return back.svg() + cat
}

const MUG = rle(['k4tk2.', 'k4c2k.', 'k4ck.k', 'k4c2k.', 'k4ck2.', '.4k3.'])

function mugs(turns: number, x: number, y: number): string {
  const layer = new Layer()
  const full = Math.min(turns, MUGS)
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
  c.rect(x, y, 20, 1, P.dusk)
  c.rect(x, y + 11, 20, 1, P.aubergine)
  c.rect(x + 2, y + 2, 16, 2, P.cream)
  c.rect(x + 3, y + 2, 5, 1, P.rose)
  c.rect(x + 3, y + 5, 14, 5, P.ink)
  c.rect(x + 6, y + 10, 8, 2, P.aubergine)
  const step = turns % 9
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
    return h.svg(`class="c-h${frame}"`)
  }
  return `<g${isWorking ? ' class="c-spin"' : ''}>${c.svg()}${hubs(0)}${hubs(1)}</g>`
}

const PLANTS: Record<Plant, readonly string[]> = {
  perky: ['l3.l2.l', '.l.lgl.l', '2.lglgl.', 'l.2glgl.', '.l2g2l2.', '2.lgl3.'],
  neutral: ['8.', '3.l4.', '.l.lgl2.', 'l2gl.gl.', '.lg2lg2.', '2.lglg2.'],
  droopy: ['8.', '8.', '3.2m3.', '.2m2gm2.', 'm.mgm.2m', 'm2.m2.m.'],
}

function plant(mood: Plant, x: number, y: number): string {
  const p = new Layer()
  p.sprite(rle(PLANTS[mood]), { l: P.leaf, g: P.moss, m: P.dusk }, x + 1, y)
  p.sprite(rle(['k8k', '.kr5uk.', '.kr5uk.', '2.5k2.']), { k: P.umber, r: P.rust, u: P.umber }, x, y + 6)
  return p.svg()
}

/** The whole card: portrait over the three instruments. */
export function buildCard(view: CardView): string {
  const w = 76
  return svg(w, 58, portrait(view, w, 40) + mugs(view.turns, 2, 49) + cassette(view.turns, view.isWorking, 44, 44) + plant(view.plant, 66, 46))
}

/** The glance a widget shows: the portrait alone. */
export function buildGlance(view: CardView): string {
  return svg(48, 34, portrait(view, 48, 34))
}
