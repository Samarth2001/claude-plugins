import { expect, test } from 'claude-code/testing'

import { emptyLog, logError, logTurn } from './phase'
import { forecast, glanceWord, modeLabel, phrasesFor, spinnerWord, summary } from './voice'

test('the spinner draws a phrase from the sky, the same for a whole turn', () => {
  expect(phrasesFor('dusk', 'clear')).toContain('Watching the light go')
  expect(phrasesFor('night', 'clear')).toContain('Counting stars')
  expect(phrasesFor('day', 'storm')).toContain('Riding out the storm')
  const word = spinnerWord('night', 'clear', 3, 'agent')
  expect(phrasesFor('night', 'clear')).toContain(word)
  expect(spinnerWord('night', 'clear', 3, 'agent')).toBe(word)
  // Across turns it varies.
  const words = new Set(Array.from({ length: 12 }, (_, turn) => spinnerWord('day', 'clear', turn, 'agent')))
  expect(words.size).toBeGreaterThan(1)
})

test('the footer label is the hour and the weather', () => {
  expect(modeLabel('dusk', 'clear')).toBe('dusk · clear')
})

test('the forecast reads the barometer in an almanac voice', () => {
  expect(forecast(emptyLog(), 'clear')).toBe('Settled. Nothing logged yet.')
  const fair = logTurn(logTurn(logTurn(logTurn(emptyLog(), { errors: 0, passed: false, testFailed: false }), { errors: 0, passed: false, testFailed: false }), { errors: 0, passed: false, testFailed: false }), { errors: 0, passed: false, testFailed: false })
  expect(forecast(fair, 'clear')).toBe('Fair. 4 turns clear.')
  const falling = logError(logError(fair))
  expect(forecast(falling, 'cloudy')).toBe('Pressure falling, 2 errors this turn.')
  expect(glanceWord(falling)).toBe('falling')
  expect(forecast(logError(logError(logError(fair))), 'storm')).toBe('Storm. 3 errors this turn.')
  expect(forecast(logError(fair, true), 'storm')).toBe('Storm. A test run failed.')
  const after = logTurn(falling, { errors: 2, passed: false, testFailed: false })
  expect(forecast(after, 'cloudy')).toBe('Unsettled. 2 errors last turn.')
  expect(forecast(logTurn(emptyLog(), { errors: 0, passed: false, testFailed: false }), 'clear')).toBe('Fair. 1 turn clear.')
})

test('the summary is three short lines', () => {
  const sky = {
    isOn: true,
    isPinned: false,
    phase: 'dusk',
    step: 0.3,
    weather: 'clear',
    hour: 17,
    minute: 54,
    moonAge: 10.5,
    date: 'Tue 17 Nov',
  } as const
  expect(summary(sky, emptyLog())).toEqual([
    'Dusk, 17:54. Clear sky; night at 20:00.',
    'Moon: waxing gibbous, 81% lit.',
    'Barometer: settled. Nothing logged yet.',
  ])
})
