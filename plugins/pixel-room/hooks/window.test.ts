import { expect, test } from 'claude-code/testing'

import type { Phase, SceneInput, Season, Weather } from './model'
import { quietScene } from './scene'
import { WINDOW_CSS, moonSpot, windowPart } from './window'

const NIGHT = { hour: 23, minute: 0, second: 0 }
const WEATHERS: Weather[] = ['rain', 'drizzle', 'snow', 'fog', 'clear']
const PHASES: Phase[] = ['dawn', 'day', 'dusk', 'night']
const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn']

const draw = (phase: Phase, overrides: Partial<SceneInput> = {}, time = NIGHT) => windowPart(quietScene('asleep', phase, overrides), time)

test('each weather draws its own markers', () => {
  for (const phase of PHASES) {
    expect(draw(phase, { weather: 'rain' })).toContain('class="pr-rn"')
    expect(draw(phase, { weather: 'rain' })).toContain('class="pr-sh"')
    expect(draw(phase, { weather: 'drizzle' })).toContain('class="pr-rn"')
    expect(draw(phase, { weather: 'drizzle' })).toContain('class="pw-bd"')
    const snow = draw(phase, { weather: 'snow' })
    expect(snow).toContain('class="pw-sf"')
    expect(snow).toContain('class="pw-sw"')
    expect(snow).not.toContain('class="pr-rn"')
    const fog = draw(phase, { weather: 'fog' })
    expect(fog).toContain('class="pw-fg"')
    expect(fog).not.toContain('class="pr-rn"')
    expect(fog).not.toContain('class="pr-sh"')
    expect(draw(phase, { weather: 'clear' })).not.toContain('class="pr-rn"')
  }
})

test('clear skies: stars from dusk to dawn, clouds and a sunbeam by day', () => {
  for (const phase of ['dusk', 'night', 'dawn'] as const) {
    expect(draw(phase, { weather: 'clear' })).toContain('class="pw-sk"')
    expect(draw(phase, { weather: 'clear' })).not.toContain('pw-sb')
  }
  const day = draw('day', { weather: 'clear' })
  expect(day).not.toContain('class="pw-sk"')
  expect(day).toContain('class="pw-cl"')
  expect(day).toContain('pw-sb')
  expect(day).toContain('class="pw-mo"')
})

test('the moon shows at night in the clear, never by day, in fog or at new moon', () => {
  expect(draw('night', { weather: 'clear' })).toContain('class="pw-mn"')
  expect(draw('night', { weather: 'rain' })).toContain('class="pw-mn"')
  expect(draw('day', { weather: 'clear' })).not.toContain('class="pw-mn"')
  expect(draw('night', { weather: 'fog' })).not.toContain('class="pw-mn"')
  expect(draw('night', { weather: 'clear', moon: 0 })).not.toContain('class="pw-mn"')
})

test('the moon crosses the sky by the hour and keeps clear of the mullion', () => {
  const evening = moonSpot('night', { hour: 19, minute: 0, second: 0 })
  const late = moonSpot('night', { hour: 23, minute: 0, second: 0 })
  const morning = moonSpot('night', { hour: 4, minute: 30, second: 0 })
  expect(evening.cx).toBeLessThan(morning.cx)
  expect(late.cy).toBeLessThan(evening.cy)
  expect(late.cy).toBeLessThan(morning.cy)
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 20, 40]) {
      const { cx, cy } = moonSpot('night', { hour, minute, second: 0 })
      expect(cx + 6 < 59 || cx - 6 > 60).toBe(true)
      expect(cy + 5).toBeLessThan(62)
    }
  }
})

test('the plane flies only with its flourish, the chase only while working', () => {
  expect(draw('night', { flourish: 'plane' })).toContain('class="pw-plane"')
  expect(draw('night')).not.toContain('pw-plane')
  expect(draw('night', { flourish: 'pet' })).not.toContain('pw-plane')
  expect(draw('night', { isWorking: true })).toContain('class="pw-ch"')
  expect(draw('night', { isWorking: false })).not.toContain('class="pw-ch"')
  // By day the bulbs are unlit: no glow and no chase.
  expect(draw('day', { isWorking: true })).not.toContain('class="pw-ch"')
  expect(draw('day')).not.toContain('class="pw-br"')
  expect(draw('night')).toContain('class="pw-br"')
})

test('every season puts its ornament on the bookcase', () => {
  const drawn = SEASONS.map(season => draw('night', { season }))
  for (const svg of drawn) expect(svg).toContain('class="pw-or"')
  expect(new Set(drawn).size).toBe(SEASONS.length)
})

test('it keeps the classes and ids the room relies on, and draws the same twice', () => {
  for (const phase of PHASES) {
    for (const weather of WEATHERS) {
      const svg = draw(phase, { weather, flourish: 'plane', isWorking: true })
      for (const marker of ['id="prglass"', 'class="pr-fp"', 'class="pr-bk"', 'class="pr-fl"']) expect(svg).toContain(marker)
      expect(svg).toBe(draw(phase, { weather, flourish: 'plane', isWorking: true }))
      expect(svg).not.toContain('<text')
      expect(svg).not.toContain('<image')
      expect(svg).not.toContain('href')
      expect(svg).not.toContain('filter')
    }
  }
  expect(WINDOW_CSS).toContain('@media (prefers-reduced-motion:reduce)')
})

test('the worst case stays small', () => {
  let worst = 0
  for (const phase of PHASES) {
    for (const weather of WEATHERS) {
      for (const season of SEASONS) {
        const svg = draw(phase, { weather, season, flourish: 'plane', isWorking: true, moon: 0.3 })
        worst = Math.max(worst, svg.length)
      }
    }
  }
  expect(worst).toBeLessThan(45_000)
})
