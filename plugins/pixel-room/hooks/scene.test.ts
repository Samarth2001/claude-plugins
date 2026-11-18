import { expect, test } from 'claude-code/testing'

import { buildCard, buildGlance } from './card'
import { pathData } from './pixels'
import type { Cat, Phase } from './room'
import { SCENE_LIMIT, buildScene, quietScene } from './scene'
import * as SPRITES from './sprites'

const CATS: Cat[] = ['asleep', 'pacing', 'watching', 'startled', 'stretch']
const PHASES: Phase[] = ['day', 'dusk', 'night']
const TIME = { hour: 22, minute: 40, second: 5 }
const ALL = PHASES.flatMap(phase => CATS.map(cat => quietScene(cat, phase)))

test('every state builds a whole SVG that fills any screen, well under the limit', () => {
  for (const state of ALL) {
    const svg = buildScene(state, TIME)
    expect(svg).toStartWith('<svg')
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('viewBox="0 0 1600 1000"')
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(svg).toContain('shape-rendering="crispEdges"')
    expect(svg).toContain('@media (max-aspect-ratio:3/4)')
    expect(svg.length).toBeLessThan(SCENE_LIMIT / 2)
  }
})

test('the scene is the same for the same state and time', () => {
  for (const state of ALL) expect(buildScene(state, TIME)).toBe(buildScene(state, TIME))
})

test('each pose draws its own cat', () => {
  const scene = (cat: Cat) => buildScene(quietScene(cat, 'night'), TIME)
  expect(scene('asleep')).toContain('class="pr-b0"')
  expect(scene('asleep')).toContain('class="pr-z"')
  expect(scene('asleep')).not.toContain('class="pr-pc"')
  expect(scene('pacing')).toContain('class="pr-pc"')
  expect(scene('pacing')).toContain('class="pr-w pr-w3"')
  expect(scene('pacing')).not.toContain('class="pr-z"')
  expect(scene('watching')).toContain('class="pr-t pr-t2"')
  // Startled jolts, then settles into watching; a stretch ends asleep.
  expect(scene('startled')).toContain('class="pr-jo"')
  expect(scene('startled')).toContain('class="pr-t pr-t0"')
  expect(scene('stretch')).toContain('class="pr-st"')
  expect(scene('stretch')).toContain('class="pr-b0"')
})

test('the lamp glows from dusk on, never by day', () => {
  expect(buildScene(quietScene('asleep', 'night'), TIME)).toContain('class="pr-gl"')
  expect(buildScene(quietScene('asleep', 'dusk'), TIME)).toContain('class="pr-gl"')
  expect(buildScene(quietScene('asleep', 'day'), TIME)).not.toContain('class="pr-gl"')
})

test('the clock shows the time it was drawn at, and keeps it after', () => {
  const svg = buildScene(quietScene('asleep', 'night'), { hour: 22, minute: 40, second: 0 })
  // 22:40 is the minute hand's ninth step and the hour hand's eleventh.
  const on = [...svg.matchAll(/class="pr-(mh|hh) pr-on" style="animation-delay:(-?\d+)s"/g)].map(m => [m[1], Number(m[2])])
  expect(on).toEqual([
    ['mh', -3600],
    ['hh', -2400],
  ])
})

test('it always rains, nothing scripts, and reduced motion stills everything', () => {
  for (const state of ALL) {
    const svg = buildScene(state, TIME)
    expect(svg).toContain('class="pr-rn"')
    expect(svg).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}')
    expect(svg).not.toContain('<script')
  }
})

test('every sprite is a rectangle', () => {
  for (const [name, value] of Object.entries(SPRITES)) {
    if (typeof value === 'function' || !Array.isArray(value)) continue
    const frames = (typeof value[0] === 'string' ? [value] : value) as string[][]
    for (const rows of frames) {
      const width = rows[0]?.length ?? 0
      expect(width).toBeGreaterThan(0)
      if (!rows.every(row => row.length === width)) throw new Error(`${name} is not a rectangle`)
    }
  }
})

test('runs merge across rows into one path', () => {
  expect(pathData([{ x: 0, y: 0, w: 2, h: 1 }, { x: 0, y: 1, w: 2, h: 1 }, { x: 3, y: 1, w: 1, h: 1 }])).toBe('M0 0h2v2h-2zM3 1h1v1h-1z')
})

test('the card and its glance are small pixel SVGs for every pose', () => {
  for (const cat of CATS) {
    const view = { cat, phase: 'night' as const, turns: 3, plant: 'perky' as const, isWorking: true }
    for (const svg of [buildCard(view), buildGlance(view)]) {
      expect(svg).toStartWith('<svg')
      expect(svg).toContain('shape-rendering="crispEdges"')
      expect(svg.length).toBeLessThan(20_000)
    }
  }
})
