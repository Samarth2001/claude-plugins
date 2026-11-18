import { expect, test } from 'claude-code/testing'

import { buildCard, buildGlance } from './card'
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

test('the card and its glance are small crisp pixel SVGs in every state', () => {
  for (const cat of CATS)
    for (const phase of PHASES)
      for (const weather of WEATHERS) {
        const v = view({ cat, phase, weather, isWorking: true, notes: { open: 3, active: 1, done: 4 }, flourish: 'pet' })
        for (const svg of [buildCard(v), buildGlance(v)]) {
          expect(svg).toStartWith('<svg')
          expect(svg.endsWith('</svg>')).toBe(true)
          expect(svg).toContain('shape-rendering="crispEdges"')
          expect(svg.length).toBeLessThan(24_000)
          for (const banned of ['<text', '<image', '<script', 'href', '<use', '<filter', 'CDATA']) expect(svg).not.toContain(banned)
        }
      }
})

test('the portrait window shows the weather and the moon', () => {
  expect(buildCard(view())).toContain('class="pk-rn"')
  expect(buildCard(view({ weather: 'snow' }))).toContain('class="pk-sn"')
  expect(buildCard(view({ weather: 'snow' }))).not.toContain('class="pk-rn"')
  expect(buildGlance(view({ weather: 'clear' }))).toContain('url(#qkmoon)')
  expect(buildGlance(view({ weather: 'clear', phase: 'day' }))).not.toContain('url(#qkmoon)')
})

test('fairy lights hang over the portrait after dark', () => {
  expect(buildCard(view({ phase: 'night' }))).toContain('url(#qkl0)')
  expect(buildCard(view({ phase: 'dawn' }))).toContain('url(#qkl0)')
  expect(buildCard(view({ phase: 'day' }))).not.toContain('url(#qkl0)')
})

test('the full card hangs a notes board while there is a list', () => {
  expect(buildCard(view())).not.toContain('url(#qkck)')
  expect(buildCard(view({ notes: { open: 1, active: 0, done: 0 } }))).toContain('url(#qkck)')
  expect(buildCard(view({ notes: { open: 1, active: 1, done: 0 } }))).toContain('class="pk-sw"')
  expect(buildGlance(view({ notes: { open: 1, active: 1, done: 0 } }))).not.toContain('url(#qkck)')
})

test('hearts only after a pet', () => {
  for (const cat of CATS) {
    expect(buildCard(view({ cat }))).not.toContain('class="pk-ht"')
    expect(buildCard(view({ cat, flourish: 'pet' }))).toContain('class="pk-ht"')
    expect(buildCard(view({ cat, flourish: 'plane' }))).not.toContain('class="pk-ht"')
  }
})

test('the cassette turns only while Claude works, and the card is the same for the same view', () => {
  expect(buildCard(view({ isWorking: true }))).toContain('class="pk-spin"')
  expect(buildCard(view())).not.toContain('class="pk-spin"')
  for (const cat of CATS) expect(buildCard(view({ cat, notes: { open: 2, active: 1, done: 9 } }))).toBe(buildCard(view({ cat, notes: { open: 2, active: 1, done: 9 } })))
})
