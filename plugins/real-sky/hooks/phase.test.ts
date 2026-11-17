import { expect, test } from 'claude-code/testing'

import {
  SETTLED,
  arcAt,
  clockText,
  dateText,
  emptyLog,
  emptyTally,
  isTestCommand,
  isWaxing,
  localTime,
  logError,
  logTurn,
  moonAge,
  moonLit,
  moonName,
  phaseAt,
  progressAt,
  stepOf,
  timeAt,
  weatherOf,
  zoneOf,
} from './phase'

test('each part of the day starts on its hour', () => {
  expect(phaseAt(4, 59)).toBe('night')
  expect(phaseAt(5, 0)).toBe('dawn')
  expect(phaseAt(7, 59)).toBe('dawn')
  expect(phaseAt(8, 0)).toBe('day')
  expect(phaseAt(16, 59)).toBe('day')
  expect(phaseAt(17, 0)).toBe('dusk')
  expect(phaseAt(19, 59)).toBe('dusk')
  expect(phaseAt(20, 0)).toBe('night')
  expect(phaseAt(0, 0)).toBe('night')
})

test('progress runs from 0 to 1 through each part, night across midnight', () => {
  expect(progressAt(8, 0)).toBe(0)
  expect(progressAt(12, 30)).toBe(0.5)
  expect(progressAt(6, 30)).toBe(0.5)
  expect(progressAt(20, 0)).toBe(0)
  expect(progressAt(0, 30)).toBe(0.5)
  expect(progressAt(4, 59)).toBeGreaterThan(0.99)
  expect(progressAt(4, 59)).toBeLessThan(1)
})

test('the sun moves in small steps', () => {
  expect(stepOf(0)).toBe(0)
  expect(stepOf(0.5)).toBe(0.5)
  expect(stepOf(0.51)).toBe(0.5)
  expect(stepOf(1)).toBe(1)
})

test('a part of the day and a progress give back the clock', () => {
  expect(timeAt('day', 0.5)).toEqual({ hour: 12, minute: 30 })
  expect(timeAt('dusk', 0)).toEqual({ hour: 17, minute: 0 })
  expect(timeAt('night', 0.5)).toEqual({ hour: 0, minute: 30 })
})

test('the sun crosses the arc from 05:00 to 20:00, and the moon crosses it by night', () => {
  expect(arcAt('dawn', 0)).toBe(0)
  expect(arcAt('day', 0)).toBe(0.2)
  expect(arcAt('dusk', 0)).toBe(0.8)
  expect(arcAt('dusk', 1)).toBe(1)
  expect(arcAt('night', 0.25)).toBe(0.25)
})

test('local time and date read this machine’s clock', () => {
  const ms = new Date(2026, 10, 17, 6, 7).getTime()
  expect(localTime(ms)).toEqual({ hour: 6, minute: 7 })
  expect(clockText(6, 7)).toBe('06:07')
  expect(dateText(ms)).toBe('Tue 17 Nov')
})

test('the moon’s phase follows the synodic month', () => {
  // The total solar eclipse of 12 August 2026 fell at a new moon, the total lunar eclipse of 3 March 2026 at a full one.
  const dark = moonAge(Date.UTC(2026, 7, 12, 17, 37))
  expect(moonLit(dark)).toBeLessThan(0.03)
  expect(moonName(dark)).toBe('new moon')
  const full = moonAge(Date.UTC(2026, 2, 3, 11, 38))
  expect(moonLit(full)).toBeGreaterThan(0.97)
  expect(moonName(full)).toBe('full moon')
  // A week after a new moon, a first quarter, waxing.
  const quarter = moonAge(Date.UTC(2026, 10, 17, 12))
  expect(moonName(quarter)).toBe('first quarter')
  expect(isWaxing(quarter)).toBe(true)
  expect(isWaxing(full + 2)).toBe(false)
  expect(moonName(22.1)).toBe('last quarter')
  expect(moonName(26)).toBe('waning crescent')
})

test('a turn’s calls make its weather', () => {
  expect(weatherOf(emptyTally())).toBe('clear')
  expect(weatherOf({ errors: 1, passed: false, testFailed: false })).toBe('cloudy')
  expect(weatherOf({ errors: 3, passed: false, testFailed: false })).toBe('storm')
  expect(weatherOf({ errors: 1, passed: false, testFailed: true })).toBe('storm')
  // Tests that pass at last clear the sky, whatever came before.
  expect(weatherOf({ errors: 5, passed: true, testFailed: false })).toBe('clear')
})

test('test commands are recognized, and watch mode or help is not a run', () => {
  expect(isTestCommand('npm test')).toBe(true)
  expect(isTestCommand('cd app && pnpm run test:unit')).toBe(true)
  expect(isTestCommand('python -m pytest -q')).toBe(true)
  expect(isTestCommand('/usr/bin/cargo test')).toBe(true)
  expect(isTestCommand('npm install')).toBe(false)
  expect(isTestCommand('vitest --watch')).toBe(false)
  expect(isTestCommand('jest --help')).toBe(false)
})

test('the barometer falls with errors and rises with clean turns, the set hand following each turn', () => {
  let log = emptyLog()
  expect(log.pressure).toBe(SETTLED)
  log = logError(log)
  log = logError(log)
  expect(log.errors).toBe(2)
  expect(log.pressure).toBeLessThan(SETTLED)
  expect(log.setHand).toBe(SETTLED) // where the turn began
  log = logTurn(log, { errors: 2, passed: false, testFailed: false })
  expect(log).toMatchObject({ turns: 1, clear: 0, errors: 0, lastErrors: 2 })
  expect(log.setHand).toBe(log.pressure)
  const low = log.pressure
  log = logTurn(log, emptyTally())
  log = logTurn(log, emptyTally())
  expect(log.clear).toBe(2)
  expect(log.pressure).toBeGreaterThan(low)
  // A failed test run drops it further than an error.
  expect(logError(emptyLog(), true).pressure).toBeLessThan(logError(emptyLog()).pressure)
  expect(logError(emptyLog(), true).testFailed).toBe(true)
})

test('the needle stays on the dial, and each reading has its word', () => {
  let log = emptyLog()
  for (let i = 0; i < 40; i++) log = logError(log)
  expect(log.pressure).toBeGreaterThan(0)
  expect(zoneOf(log.pressure)).toBe('stormy')
  for (let i = 0; i < 40; i++) log = logTurn(log, { errors: 0, passed: true, testFailed: false })
  expect(log.pressure).toBeLessThan(1)
  expect(zoneOf(log.pressure)).toBe('very dry')
  expect(zoneOf(0.5)).toBe('change')
  expect(zoneOf(SETTLED)).toBe('fair')
})
