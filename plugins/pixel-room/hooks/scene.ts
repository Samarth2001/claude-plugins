// The room as one SVG document, drawn on a grid of 320 by 200 art pixels: a
// tall window on the left with the cat's cushion on its sill and a low
// bookcase beneath, the window's light falling across the floor, and a desk
// on the right with a lamp, a monitor, a mug, a trailing plant and a wall
// clock that keeps the real time. The centre and the foot stay dark for the
// conversation. Pure and deterministic for its input; every motion is CSS in
// the document's own <style>.
//
// Each part is its own module and brings its own CSS: shell.ts (wall and
// floor), window.ts (the window wall and the weather), desk.ts (the desk
// wall) and cat.ts (the cat, wherever it is). This file lays them out.

import { CAT_CSS, floorCat, sillCat } from './cat'
import { DESK_CSS, deskPart } from './desk'
import type { Cat, Clock, Phase, SceneInput } from './model'
import { NO_NOTES } from './model'
import { P, PX, defs } from './paint'
import { SHELL_CSS, shellPart } from './shell'
import { WINDOW_CSS, windowPart } from './window'

/** The most an Svg's source may hold. */
export const SCENE_LIMIT = 131_072

// The layout for any screen, and the stillness for reduced motion. A part
// tags what a tall phone screen has no room for with `pr-tall-hide`.
const LAYOUT_CSS = [
  '@media (max-aspect-ratio:5/4){.pr-l{transform:translate(46px,0)}.pr-r{transform:translate(-56px,0)}}',
  '@media (max-aspect-ratio:3/4){.pr-l{transform:translate(98px,-34px)}.pr-r{transform:translate(-104px,0)}.pr-bk,.pr-fp,.pr-wd,.pr-tall-hide{display:none}}',
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}',
].join('')

const STYLE = SHELL_CSS + WINDOW_CSS + DESK_CSS + CAT_CSS + LAYOUT_CSS

/** The colour laid over the whole room for the time of day: cool by day, rosy at dusk and dawn, warm under the lamp. */
function tint(phase: Phase): string {
  const [color, opacity] = phase === 'day' ? [P.steel, 0.07] : phase === 'dusk' || phase === 'dawn' ? [P.rose, 0.06] : [P.amber, 0.05]
  return `<rect x="-400" y="-400" width="1120" height="1000" fill="${color}" opacity="${opacity}"/>`
}

/** The whole room for one input, its clock showing `time`. */
export function buildScene(input: SceneInput, time: Clock): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" shape-rendering="crispEdges">` +
    `<style>${STYLE}</style>` +
    `<defs>${defs()}</defs>` +
    `<g transform="scale(${PX})">` +
    shellPart(input) +
    `<g class="pr-l">${windowPart(input, time)}${sillCat(input)}</g>` +
    `<g class="pr-r">${deskPart(input, time)}${floorCat(input)}</g>` +
    tint(input.phase) +
    `</g></svg>`
  )
}

/**
 * A plain evening for tests and the preview: rain, no subagents, no list,
 * no flourish, a fixed autumn date, the monitor at work while the cat is up.
 */
export function quietScene(cat: Cat, phase: Phase, overrides: Partial<SceneInput> = {}): SceneInput {
  const isWorking = cat === 'pacing' || cat === 'watching' || cat === 'startled'
  return {
    cat,
    phase,
    lampOn: phase !== 'day',
    weather: 'rain',
    season: 'autumn',
    moon: 0.5,
    monitor: cat === 'startled' ? 'error' : isWorking ? 'working' : 'idle',
    moths: 0,
    notes: NO_NOTES,
    flourish: 'none',
    date: { month: 10, day: 18, weekday: 3 },
    isWorking,
    ...overrides,
  }
}
