// The cat in the room: on its cushion on the windowsill while it sleeps or
// stretches, and on the floor in front of the desk while it paces, watches
// or startles. Sprites are sprites.ts's; this places and animates them.

import { FLOOR, P } from './paint'
import { Layer } from './pixels'
import type { SceneInput } from './model'
import { ASLEEP, CAT_KEYS, SIT, SIT_TAIL, STARTLED, STARTLED_TAIL, STRETCH, WALK_BODY, WALK_LEGS, ZED, rle } from './sprites'
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
  '@media (prefers-reduced-motion:reduce){.pr-b1,.pr-w1,.pr-w2,.pr-w3,.pr-t1,.pr-t2,.pr-jo,.pr-st{opacity:0}.pr-w0,.pr-t0,.pr-af{opacity:1}.pr-z{opacity:.6}}',
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
  let cat = ''
  if (input.cat === 'asleep') cat = sleeper(31, sy - 15)
  else if (input.cat === 'stretch') {
    cat =
      `<g class="pr-st">${new Layer().sprite(STRETCH, CAT_KEYS, 30, sy - 17).svg()}</g>` +
      `<g class="pr-af">${sleeper(31, sy - 15)}</g>`
  }
  return c.svg() + cat
}

function sleeper(x: number, y: number): string {
  const [out, inn] = ASLEEP
  const zed = (i: number) =>
    `<g class="pr-z" style="animation-delay:${(i * 2.2).toFixed(1)}s">${new Layer().sprite(ZED, { z: P.mist }, x + 22, y - 4).svg()}</g>`
  return (
    `<g class="pr-b0">${new Layer().sprite(out ?? [], CAT_KEYS, x, y).svg()}</g>` +
    `<g class="pr-b1">${new Layer().sprite(inn ?? [], CAT_KEYS, x, y).svg()}</g>` +
    zed(0) +
    zed(1) +
    zed(2)
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
    const body = new Layer().sprite(WALK_BODY, CAT_KEYS, 0, 0).svg()
    return (
      `<g class="pr-pc" style="--x:186px"><g transform="translate(186 ${top})"><g class="pr-fc">` +
      `<g class="pr-bob">${body}</g>${frames}</g></g></g>`
    )
  }
  if (input.cat === 'watching' || input.cat === 'startled') {
    const x = 232
    const y = feet - SIT.length
    const tails = SIT_TAIL.map((tail, i) => `<g class="pr-t pr-t${i}">${new Layer().sprite(tail, CAT_KEYS, x - 6, y + SIT.length - 7).svg()}</g>`).join('')
    const sitting = `${tails}${new Layer().sprite(SIT, CAT_KEYS, x, y).svg()}`
    if (input.cat === 'watching') return `<g>${sitting}</g>`
    const startled =
      new Layer().sprite(STARTLED_TAIL, CAT_KEYS, x - 3, y + 3).svg() + new Layer().sprite(STARTLED, CAT_KEYS, x, y).svg()
    return `<g class="pr-jo">${startled}</g><g class="pr-af">${sitting}</g>`
  }
  return ''
}
