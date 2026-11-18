import { expect, test } from 'claude-code/testing'

import type { Season, Weather } from './model'
import { isMoonUp, isSouthernZone, moonName, moonPhase, phaseAt, seasonOf, weatherFor, weatherWord } from './sky'

test('dawn from 05:00, day from 07:00, dusk from 17:00, night from 19:00', () => {
  expect([5, 6].map(phaseAt)).toEqual(['dawn', 'dawn'])
  expect([7, 12, 16].map(phaseAt)).toEqual(['day', 'day', 'day'])
  expect([17, 18].map(phaseAt)).toEqual(['dusk', 'dusk'])
  expect([19, 23, 0, 4].map(phaseAt)).toEqual(['night', 'night', 'night', 'night'])
})

test('seasons turn around south of the equator', () => {
  expect([0, 3, 6, 9].map(month => seasonOf(month))).toEqual(['winter', 'spring', 'summer', 'autumn'])
  expect([0, 3, 6, 9].map(month => seasonOf(month, true))).toEqual(['summer', 'autumn', 'winter', 'spring'])
  expect(seasonOf(11)).toBe('winter')
  expect(['Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/Argentina/Cordoba', 'Africa/Johannesburg'].every(isSouthernZone)).toBe(true)
  expect(['Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC', undefined].some(isSouthernZone)).toBe(false)
})

test('the weather holds all day, changes over the days, and snows only in winter', () => {
  const day = { year: 2026, month: 10, day: 18 }
  expect(weatherFor(day, 'autumn')).toBe(weatherFor({ ...day }, 'autumn'))
  const seen = new Map<Season, Set<Weather>>()
  for (const season of ['winter', 'spring', 'summer', 'autumn'] as const) {
    const kinds = new Set<Weather>()
    let rainy = 0
    for (let d = 1; d <= 365; d += 1) {
      const date = new Date(Date.UTC(2026, 0, d))
      const weather = weatherFor({ year: 2026, month: date.getUTCMonth(), day: date.getUTCDate() }, season)
      kinds.add(weather)
      if (weather === 'rain' || weather === 'drizzle') rainy += 1
    }
    seen.set(season, kinds)
    // Rain is the room's weather: never rare.
    expect(rainy).toBeGreaterThan(365 * 0.25)
  }
  expect(seen.get('winter')?.has('snow')).toBe(true)
  for (const season of ['spring', 'summer', 'autumn'] as const) expect(seen.get(season)?.has('snow')).toBe(false)
  expect(seen.get('summer')?.has('clear')).toBe(true)
})

test('the moon keeps its real phase', () => {
  // A full moon on 2024-01-25 17:54 UTC, a new moon on 2024-02-09 22:59 UTC.
  expect(moonPhase(Date.UTC(2024, 0, 25, 17, 54))).toBe(0.5)
  expect([0, 1].includes(moonPhase(Date.UTC(2024, 1, 9, 22, 59)))).toBe(true)
  expect(moonName(moonPhase(Date.UTC(2024, 0, 25, 17, 54)))).toBe('full moon')
  expect(moonName(0.25)).toBe('first quarter')
  expect(moonName(0.125)).toBe('waxing crescent')
  expect(moonName(0.875)).toBe('waning crescent')
  for (let ms = 0; ms < 40 * 86_400_000; ms += 86_400_000) {
    const moon = moonPhase(Date.UTC(2026, 0, 1) + ms)
    expect(moon).toBeGreaterThanOrEqual(0)
    expect(moon).toBeLessThan(1)
    expect((moon * 16) % 1).toBe(0)
  }
})

test('the moon shows from dusk to dawn unless it is new or the fog is in', () => {
  expect(isMoonUp('night', 'rain', 0.5)).toBe(true)
  expect(isMoonUp('day', 'clear', 0.5)).toBe(false)
  expect(isMoonUp('night', 'fog', 0.5)).toBe(false)
  expect(isMoonUp('night', 'clear', 0)).toBe(false)
  expect(weatherWord('snow')).toBe('snowing')
})
