import { expect, test } from 'claude-code/testing'

import { bandWidth, buildBand } from './band'
import type { Cat, Phase, RoomView, Weather } from './model'
import { NO_NOTES } from './model'

const CATS: Cat[] = ['asleep', 'pacing', 'watching', 'startled', 'stretch']
const PHASES: Phase[] = ['dawn', 'day', 'dusk', 'night']
const WEATHERS: Weather[] = ['rain', 'drizzle', 'snow', 'fog', 'clear']

const view = (more: Partial<RoomView> = {}): RoomView => ({
  cat: 'asleep',
  phase: 'night',
  weather: 'rain',
  moon: 0.5,
  turns: 3,
  plant: 'perky',
  isWorking: false,
  moths: 0,
  notes: NO_NOTES,
  flourish: 'none',
  ...more,
})

// The busiest band there is: the widest, lit, working, with a full list, moths and a flourish.
const BUSY = view({ isWorking: true, moths: 3, notes: { open: 4, active: 1, done: 5 }, turns: 9, weather: 'snow', flourish: 'pet' })

test('the band is a crisp pixel SVG sized to the columns, clamped at both ends', () => {
  const svg = buildBand(view(), 120)
  expect(svg).toStartWith('<svg')
  expect(svg.endsWith('</svg>')).toBe(true)
  expect(svg).toContain('shape-rendering="crispEdges"')
  expect(svg).toContain('preserveAspectRatio="xMinYMid meet"')
  expect(svg).toContain('viewBox="0 0 450 16"')
  expect(svg).toContain('width="900" height="32"')
  expect(bandWidth(60)).toBe(225)
  expect(bandWidth(10)).toBe(120)
  expect(bandWidth(1000)).toBe(640)
  expect(bandWidth(Number.NaN)).toBe(120)
  expect(buildBand(view(), 0)).toContain('viewBox="0 0 120 16"')
  expect(buildBand(view(), 500)).toContain('viewBox="0 0 640 16"')
})

test('every pose, phase and weather draws, small, with nothing the engine refuses', () => {
  for (const cat of CATS)
    for (const phase of PHASES)
      for (const weather of WEATHERS)
        for (const columns of [20, 60, 200]) {
          const svg = buildBand(view({ cat, phase, weather, isWorking: true, moths: 2, notes: { open: 1, active: 1, done: 1 } }), columns)
          expect(svg.length).toBeLessThan(24_000)
          for (const banned of ['<text', '<image', '<script', 'href', '<use', '<filter', 'CDATA']) expect(svg).not.toContain(banned)
        }
  for (const flourish of ['pet', 'plane'] as const) for (const cat of CATS) expect(buildBand({ ...BUSY, cat, flourish }, 500).length).toBeLessThan(24_000)
})

test('each pose draws its own cat', () => {
  const band = (cat: Cat) => buildBand(view({ cat }), 120)
  expect(band('asleep')).toContain('class="pb-b0"')
  expect(band('asleep')).toContain('class="pb-z"')
  expect(band('stretch')).toContain('class="pb-b1"')
  expect(band('pacing')).toContain('class="pb-pc"')
  expect(band('pacing')).toContain('class="pb-w pb-w3"')
  expect(band('pacing')).not.toContain('class="pb-b0"')
  expect(band('watching')).toContain('class="pb-t pb-t2"')
  expect(band('watching')).toContain('class="pb-bl"')
  expect(band('startled')).toContain('class="pb-jo"')
  expect(band('startled')).toContain('class="pb-af"')
})

test('the weather shows in the window', () => {
  expect(buildBand(view({ weather: 'rain' }), 120)).toContain('class="pb-rn"')
  expect(buildBand(view({ weather: 'drizzle' }), 120)).toContain('class="pb-dz"')
  expect(buildBand(view({ weather: 'snow' }), 120)).toContain('class="pb-sn"')
  expect(buildBand(view({ weather: 'snow' }), 120)).not.toContain('class="pb-rn"')
  expect(buildBand(view({ weather: 'fog' }), 120)).toContain('class="pb-fg"')
  // The moon on a clear night, not by day, not in fog.
  expect(buildBand(view({ weather: 'clear' }), 120)).toContain('url(#qbmoon)')
  expect(buildBand(view({ weather: 'clear', phase: 'day' }), 120)).not.toContain('url(#qbmoon)')
  expect(buildBand(view({ weather: 'clear', phase: 'day' }), 120)).toContain('url(#qbsun)')
  expect(buildBand(view({ weather: 'clear', moon: 0 }), 120)).not.toContain('url(#qbmoon)')
})

test('the fairy lights glow after dark and chase while Claude works', () => {
  expect(buildBand(view({ phase: 'day' }), 120)).not.toContain('url(#qbl0)')
  expect(buildBand(view({ phase: 'dusk' }), 120)).toContain('url(#qbl0)')
  expect(buildBand(view(), 120)).toContain('class="pb-g pb-g1"')
  expect(buildBand(view(), 120)).not.toContain('class="pb-ch')
  expect(buildBand(view({ isWorking: true }), 120)).toContain('class="pb-ch pb-c3"')
})

test('the instruments follow the session', () => {
  expect(buildBand(view(), 120)).not.toContain('class="pb-mo')
  expect([...buildBand(view({ moths: 2 }), 120).matchAll(/class="pb-mo pb-m\d"/g)]).toHaveLength(2)
  expect([...buildBand(view({ moths: 9 }), 120).matchAll(/class="pb-mo pb-m\d"/g)]).toHaveLength(3)
  expect(buildBand(view(), 120)).not.toContain('url(#qbck)')
  expect(buildBand(view({ notes: { open: 1, active: 1, done: 1 } }), 120)).toContain('url(#qbck)')
  expect(buildBand(view({ notes: { open: 1, active: 1, done: 1 } }), 120)).toContain('class="pb-pu"')
  expect(buildBand(view({ turns: 0 }), 120)).not.toContain('class="pb-sm"')
  expect(buildBand(view({ turns: 2 }), 120)).toContain('class="pb-sm"')
})

test('flourishes play only while set', () => {
  for (const cat of CATS) {
    expect(buildBand(view({ cat }), 120)).not.toContain('class="pb-h"')
    expect(buildBand(view({ cat, flourish: 'pet' }), 120)).toContain('class="pb-h"')
  }
  expect(buildBand(view(), 120)).not.toContain('class="pb-pl"')
  expect(buildBand(view({ flourish: 'plane' }), 120)).toContain('class="pb-pl"')
  expect(buildBand(view({ flourish: 'plane' }), 120)).toContain('forwards')
})

test('reduced motion leaves a finished picture', () => {
  const svg = buildBand(BUSY, 120)
  expect(svg).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}')
  const still = svg.match(/@media \(prefers-reduced-motion:reduce\)\{(.*?)\}\}/)?.[1] ?? ''
  for (const hidden of ['.pb-b1', '.pb-h', '.pb-pl', '.pb-jo', '.pb-bl']) expect(still).toContain(hidden)
})

test('the band is the same for the same view and width', () => {
  for (const cat of CATS) expect(buildBand({ ...BUSY, cat }, 90)).toBe(buildBand({ ...BUSY, cat }, 90))
})
