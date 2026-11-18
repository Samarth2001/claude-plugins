// The cat in the room: on its cushion on the windowsill while it sleeps or
// stretches, and on the floor in front of the desk while it paces, watches
// or startles. Sprites are sprites.ts's; this places and animates them.

import { FLOOR, P } from './paint'
import { Layer, type Sprite } from './pixels'
import type { SceneInput } from './model'
import { ASLEEP, CAT_KEYS, HEART, SIT, SIT_TAIL, STARTLED, STARTLED_TAIL, STRETCH, WALK_BODY, WALK_LEGS, ZED, rle } from './sprites'
import { GLASS } from './window'

void FLOOR

export const CAT_CSS = [
  '.pr-b0{animation:pr-breath 4.8s step-end infinite}',
  '.pr-b1{opacity:0;animation:pr-breath 4.8s step-end infinite reverse}',
  '.pr-z{opacity:0;animation:pr-z 6.6s steps(10,end) infinite}',
  '.pr-pc{animation:pr-pace 18s steps(90,end) infinite}',
  '.pr-fc{transform-box:fill-box;transform-origin:center;animation:pr-face 18s step-end infinite}',
  '.pr-w{opacity:0;animation:pr-step .64s step-end infinite}',
  '.pr-w0{animation-delay:0s}.pr-w1{animation-delay:-.48s}.pr-w2{animation-delay:-.32s}.pr-w3{animation-delay:-.16s}',
  '.pr-bob{animation:pr-bob .32s step-end infinite}',
  '.pr-t{opacity:0;animation:pr-tail 2.4s step-end infinite}',
  '.pr-t0{animation-delay:0s}.pr-t1{animation-delay:-1.6s}.pr-t2{animation-delay:-.8s}',
  '.pr-jo{animation:pr-jolt 2.6s steps(1,end) forwards}',
  '.pr-st{animation:pr-once 3.4s step-end forwards}',
  '.pr-af{opacity:0;animation:pr-after 3.4s step-end forwards}',
  '@keyframes pr-breath{0%{opacity:1}50%{opacity:0}}',
  '@keyframes pr-z{0%{transform:translate(0,0);opacity:0}10%{opacity:.9}100%{transform:translate(5px,-10px);opacity:0}}',
  '@keyframes pr-pace{0%{transform:translateX(0)}45%{transform:translateX(90px)}50%{transform:translateX(90px)}95%{transform:translateX(0)}100%{transform:translateX(0)}}',
  '@keyframes pr-face{0%{transform:scaleX(1)}47.5%{transform:scaleX(-1)}97.5%{transform:scaleX(1)}}',
  '@keyframes pr-step{0%{opacity:1}25%{opacity:0}}',
  '@keyframes pr-bob{0%{transform:translateY(0)}50%{transform:translateY(1px)}}',
  '@keyframes pr-tail{0%{opacity:1}33.3%{opacity:0}}',
  '@keyframes pr-jolt{0%{transform:translateY(-3px)}8%{transform:translateY(0)}100%{opacity:0;transform:translateY(0)}}',
  '@keyframes pr-once{0%{opacity:1}100%{opacity:0}}',
  '@keyframes pr-after{0%{opacity:0}100%{opacity:1}}',
  // The sleeper's ear twitch and tail tip, the watcher's blink, the walker's tail.
  '.pc-e0{animation:pc-e0 11s step-end infinite}.pc-e1{opacity:0;animation:pc-e1 11s step-end infinite}',
  '.pc-tt{opacity:0;animation:pc-tt 7.4s step-end infinite}',
  '.pc-bl{opacity:0;animation:pc-bl 6.2s step-end infinite}',
  '.pc-s0{animation:pc-sw 2.6s step-end infinite}.pc-s1{opacity:0;animation:pc-sw 2.6s step-end infinite reverse}',
  // Petting: the ear lifts for a moment and three hearts rise, once.
  '.pc-eh{animation:pc-eh 3s step-end forwards}.pc-el{opacity:0;animation:pc-el 3s step-end forwards}',
  '.pc-h{opacity:0;animation:pc-h 3s steps(8,end) forwards}',
  '@keyframes pc-e0{0%{opacity:1}93%{opacity:0}95%{opacity:1}}',
  '@keyframes pc-e1{0%{opacity:0}93%{opacity:1}95%{opacity:0}}',
  '@keyframes pc-tt{0%{opacity:0}58%{opacity:1}74%{opacity:0}}',
  '@keyframes pc-bl{0%{opacity:0}97%{opacity:1}}',
  '@keyframes pc-sw{0%{opacity:1}50%{opacity:0}}',
  '@keyframes pc-eh{0%{opacity:1}8%{opacity:0}50%{opacity:1}}',
  '@keyframes pc-el{0%{opacity:0}8%{opacity:1}50%{opacity:0}}',
  '@keyframes pc-h{0%{opacity:0;transform:translate(0,0)}12%{opacity:1}60%{opacity:1}100%{opacity:0;transform:translate(0,-12px)}}',
  '@media (prefers-reduced-motion:reduce){.pr-b1,.pr-w1,.pr-w2,.pr-w3,.pr-t1,.pr-t2,.pr-jo,.pr-st,.pc-e1,.pc-tt,.pc-bl,.pc-s1,.pc-el,.pc-h{opacity:0}.pr-w0,.pr-t0,.pr-af,.pc-e0,.pc-s0,.pc-eh{opacity:1}.pr-z{opacity:.6}}',
].join('')

/** The cushion on the sill, and whichever cat is on it. */
export function sillCat(input: SceneInput): string {
  const c = new Layer()
  const sy = GLASS.y + GLASS.h
  // A plump cushion: a lit top, a seam, a shadowed underside.
  c.sprite(
    rle(['2.26r2.', '.r28r.', 'v3r1d22r1d3rv', 'v28vv', '.v28v.', '2.26v2.'].map(row => row)),
    { r: P.rose, v: P.mauve, d: P.dusk },
    28,
    sy - 6,
  )
  const pet = input.flourish === 'pet'
  let cat = ''
  if (input.cat === 'asleep') cat = sleeper(31, sy - 15, pet)
  else if (input.cat === 'stretch') {
    cat =
      `<g class="pr-st">${new Layer().sprite(STRETCH, CAT_KEYS, 30, sy - 17).svg()}</g>` +
      `<g class="pr-af">${sleeper(31, sy - 15, pet)}</g>`
  }
  const hearts = pet && (input.cat === 'asleep' || input.cat === 'stretch') ? petHearts(48, sy - 22) : ''
  return c.svg() + cat + hearts
}

/** A sprite with the pixels inside a box made clear, so an overlay can draw them its own way. */
function without(rows: Sprite, x: number, y: number, w: number, h: number): Sprite {
  return rows.map((row, r) => (r < y || r >= y + h ? row : row.slice(0, x) + '.'.repeat(w) + row.slice(x + w)))
}

const draw = (rows: Sprite, x: number, y: number, attributes = '') => new Layer().sprite(rows, CAT_KEYS, x, y).svg(attributes)

/** Three hearts rising from a head at (x, y), staggered, once. */
function petHearts(x: number, y: number): string {
  const glow = `<defs><radialGradient id="qch"><stop offset="0" stop-color="${P.rose}" stop-opacity=".45"/><stop offset="1" stop-color="${P.rose}" stop-opacity="0"/></radialGradient></defs>`
  return (
    glow +
    [-7, 0, 7]
      .map((dx, i) => {
        const hx = x + dx
        const hy = y + (i === 1 ? -4 : 0)
        return `<g class="pc-h" style="animation-delay:${(i * 0.6).toFixed(1)}s"><circle cx="${hx + 3.5}" cy="${hy + 2.5}" r="6" fill="url(#qch)"/>${draw(HEART, hx, hy)}</g>`
      })
      .join('')
  )
}

function sleeper(x: number, y: number, pet: boolean): string {
  // The near ear is its own overlay: up, now and then flicked back, and lifted when petted.
  const [out, inn] = ASLEEP.map(rows => without(rows, 14, 0, 3, 2))
  const ear = draw(rle(['.k.', 'knk']), x + 14, y, 'class="pc-e0"') + draw(rle(['k2.', '3k']), x + 14, y, 'class="pc-e1"')
  const ears = pet ? `<g class="pc-eh">${ear}</g>${draw(rle(['.k.', 'knk', 'knk']), x + 14, y - 1, 'class="pc-el"')}` : ear
  const tip = draw(['ck'], x + 19, y + 10, 'class="pc-tt"')
  const zed = (i: number) =>
    `<g class="pr-z" style="animation-delay:${(i * 2.2).toFixed(1)}s">${new Layer().sprite(ZED, { z: P.mist }, x + 22, y - 4).svg()}</g>`
  return (
    `<g class="pr-b0">${new Layer().sprite(out ?? [], CAT_KEYS, x, y).svg()}</g>` +
    `<g class="pr-b1">${new Layer().sprite(inn ?? [], CAT_KEYS, x, y).svg()}</g>` +
    ears +
    tip +
    (pet ? '' : zed(0) + zed(1) + zed(2))
  )
}


/** The cat on the floor in front of the desk: pacing, sitting up to watch, or startled. */
export function floorCat(input: SceneInput): string {
  const feet = 178
  if (input.cat === 'pacing') {
    const top = feet - (WALK_BODY.length + 3)
    const frames = WALK_LEGS.map(
      (legs, i) => `<g class="pr-w pr-w${i}">${new Layer().sprite(legs, CAT_KEYS, 0, WALK_BODY.length - 1).svg()}</g>`,
    ).join('')
    // The tail's tip sways from side to side as it walks.
    const body = draw(without(WALK_BODY, 0, 0, 4, 2), 0, 0)
    const tail = draw(rle(['.2k.', 'k2dk']), 0, 0, 'class="pc-s0"') + draw(rle(['2.2k', '.k2dk']), 0, 0, 'class="pc-s1"')
    const hearts = input.flourish === 'pet' ? petHearts(10, -8) : ''
    return (
      `<g class="pr-pc" style="--x:186px"><g transform="translate(186 ${top})"><g class="pr-fc">` +
      `<g class="pr-bob">${body}${tail}</g>${frames}</g>${hearts}</g></g>`
    )
  }
  if (input.cat === 'watching' || input.cat === 'startled') {
    const x = 232
    const y = feet - SIT.length
    const tails = SIT_TAIL.map((tail, i) => `<g class="pr-t pr-t${i}">${new Layer().sprite(tail, CAT_KEYS, x - 6, y + SIT.length - 7).svg()}</g>`).join('')
    // It blinks every few seconds: the eye closed to the outline colour for a moment.
    const blink = new Layer().rect(x + 13, y + 5, 2, 1, P.umber).svg('class="pc-bl"')
    const sitting = `${tails}${new Layer().sprite(SIT, CAT_KEYS, x, y).svg()}${blink}`
    const hearts = input.flourish === 'pet' ? petHearts(x + 9, y - 8) : ''
    if (input.cat === 'watching') return `<g>${sitting}</g>${hearts}`
    const startled =
      new Layer().sprite(STARTLED_TAIL, CAT_KEYS, x - 3, y + 3).svg() + new Layer().sprite(STARTLED, CAT_KEYS, x, y).svg()
    return `<g class="pr-jo">${startled}</g><g class="pr-af">${sitting}</g>${hearts}`
  }
  return ''
}
