import { expect, test } from 'claude-code/testing'

import type { Notes, Phase, Weather } from './model'
import { NO_NOTES } from './model'
import { bandAlt, caption, describeRoom, doneWord, freshOutcome, isTestCommand, modeLabel, moonWords, noteCall, sceneAlt, soundFor, spinnerPhrase, weatherReport } from './room'
import { quietScene } from './scene'

const FULL = 0.5
const room = (phase: Phase, weather: Weather = 'rain', more: { moon?: number; moths?: number; notes?: Notes; cat?: 'asleep' | 'watching' } = {}) => ({
  cat: more.cat ?? ('asleep' as const),
  phase,
  weather,
  moon: more.moon ?? FULL,
  moths: more.moths ?? 0,
  notes: more.notes ?? NO_NOTES,
})

test('test commands are told from other commands', () => {
  for (const line of ['npm test', 'cd app && npm run test:unit', 'npx vitest run', 'python3 -m pytest -q', 'cargo test', 'go test ./...', 'Invoke-Pester', 'claude plugin test plugins/x']) {
    expect(isTestCommand(line)).toBe(true)
  }
  for (const line of ['npm install', 'ls tests', 'git status', 'vitest --watch', 'pytest --version']) {
    expect(isTestCommand(line)).toBe(false)
  }
})

test('a clean turn finishes; an errored last call or a failed test run is a failure', () => {
  const end = { isAborted: false, reason: 'answer' }
  expect(soundFor(freshOutcome(), end)).toBe('finish')
  const errored = noteCall(freshOutcome(), { isError: true, isTestRun: false })
  expect(soundFor(errored, end)).toBe('failure')
  expect(soundFor(noteCall(errored, { isError: false, isTestRun: false }), end)).toBe('finish')
  const failed = noteCall(freshOutcome(), { isError: true, isTestRun: true })
  expect(soundFor(noteCall(failed, { isError: false, isTestRun: false }), end)).toBe('failure')
  expect(soundFor(noteCall(failed, { isError: false, isTestRun: true }), end)).toBe('finish')
})

test('a stopped turn plays nothing; an API error or refusal is a failure', () => {
  expect(soundFor(freshOutcome(), { isAborted: true, reason: 'aborted' })).toBeUndefined()
  expect(soundFor(freshOutcome(), { isAborted: false, reason: 'error' })).toBe('failure')
  expect(soundFor(freshOutcome(), { isAborted: false, reason: 'refusal' })).toBe('failure')
})

test('the room speaks in one voice', () => {
  expect(describeRoom(room('night'))).toBe('Rain on the glass, the lamp lit. A full moon behind the rain.\nThe cat is asleep on the sill.')
  expect(describeRoom(room('day', 'rain', { cat: 'watching' }))).toBe('Rain on the glass, the lamp off.\nThe cat is watching you work.')
  expect(describeRoom(room('night', 'clear', { moon: 0.25, moths: 2, notes: { open: 2, active: 1, done: 1 } }))).toBe(
    'A clear sky over the city, the lamp lit. A first-quarter moon over the city.\nThe cat is asleep on the sill. Four notes on the corkboard, one done. Two moths circle the lamp.',
  )
  expect(describeRoom(room('day', 'snow', { moths: 1, notes: { open: 0, active: 0, done: 3 } }))).toBe(
    'Snow falling past the window, the lamp off.\nThe cat is asleep on the sill. Three notes on the corkboard, all done. A moth circles the screen.',
  )
  expect(describeRoom(room('dawn', 'fog'))).toBe('Fog over the city, the lamp still lit.\nThe cat is asleep on the sill.')
  expect(caption('pacing')).toBe('pacing the floorboards')
})

test('the footer label follows the weather and the light', () => {
  expect(modeLabel(room('night'))).toBe('raining · lamp on')
  expect(modeLabel(room('day'))).toBe('raining · lamp off')
  expect(modeLabel(room('night', 'snow'))).toBe('snowing · lamp on')
  expect(modeLabel(room('night', 'clear'))).toBe('clear · full moon')
  expect(modeLabel(room('night', 'clear', { moon: 0 }))).toBe('clear · lamp on')
  expect(modeLabel(room('day', 'fog'))).toBe('foggy · lamp off')
  expect(modeLabel(room('dawn', 'drizzle'))).toBe('drizzle · dawn')
  expect(modeLabel(room('dusk'))).toBe('raining · dusk')
})

test('the moon has a name for every phase', () => {
  expect([0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map(moonWords)).toEqual([
    'new moon',
    'waxing crescent moon',
    'first-quarter moon',
    'waxing gibbous moon',
    'full moon',
    'waning gibbous moon',
    'last-quarter moon',
    'waning crescent moon',
  ])
  expect(weatherReport('snow', 0.5, false)).toBe("Snow today: the room's own weather, not a forecast.\nThe moon is full.")
  expect(weatherReport('clear', 0.25, true)).toBe("The weather is pinned to clear. /pixel-room weather auto brings back the day's own.\nThe moon is at first quarter.")
  expect(weatherReport('rain', 0.125, false)).toContain('The moon is a waxing crescent.')
})

test('the spinner keeps to the room: the weather, the time and what is going on', () => {
  expect(spinnerPhrase(3, 'thinking', room('night'))).toBe(spinnerPhrase(3, 'thinking', room('night')))
  expect(spinnerPhrase(1, 'tool-use', room('night'))).toMatch(/watching|Tail/)
  const all = (r: ReturnType<typeof room>) =>
    new Set((['thinking', 'responding', 'tool-use'] as const).flatMap(mode => [0, 1, 2, 3, 4, 5].map(turn => spinnerPhrase(turn, mode, r))))
  expect(all(room('night', 'snow'))).toContain('Snow on the sill')
  expect(all(room('night', 'clear'))).toContain('Moon over the city')
  expect(all(room('dawn'))).toContain('First light')
  expect(all(room('night', 'rain', { moths: 1 }))).toContain('Moths at the lamp')
  expect(all(room('night', 'rain', { notes: { open: 1, active: 1, done: 0 } }))).toContain('Ticking off a note')
  expect(all(room('night'))).not.toContain('Moths at the lamp')
  expect(all(room('night'))).not.toContain('Ticking off a note')
  for (const phrase of all(room('night', 'clear', { moths: 2, notes: { open: 1, active: 0, done: 0 } }))) expect(phrase.length).toBeLessThan(30)
})

test('the captions read naturally for every state', () => {
  expect(sceneAlt(quietScene('asleep', 'night'))).toBe('A pixel room at night, the desk lamp lit: rain on the window and a cat asleep on the sill')
  expect(sceneAlt(quietScene('watching', 'day', { weather: 'clear', moths: 1, notes: { open: 1, active: 1, done: 0 }, flourish: 'plane' }))).toBe(
    'A pixel room by day, the lamp off: sun through the window and a cat watching you work, with one moth at the screen, two notes on the corkboard and a paper plane gliding past the window',
  )
  expect(sceneAlt(quietScene('asleep', 'night', { weather: 'clear', flourish: 'pet' }))).toBe(
    'A pixel room at night, the desk lamp lit: a full moon in a clear sky and a cat asleep on the sill, purring',
  )
  expect(sceneAlt(quietScene('pacing', 'dawn', { weather: 'snow' }))).toContain('at dawn, the desk lamp still lit: snow falling outside')
  const view = { cat: 'asleep', phase: 'night', weather: 'fog', moon: 0.5, turns: 0, plant: 'neutral', isWorking: false, moths: 0, notes: NO_NOTES, flourish: 'none' } as const
  expect(bandAlt(view)).toBe('A strip of the pixel room: fog at the window, the cat asleep on the sill')
  expect(bandAlt({ ...view, weather: 'clear', phase: 'dusk' })).toBe('A strip of the pixel room: a clear dusk, the cat asleep on the sill')
})

test("a turn's closing line takes one of the room's words, the same for the same line", () => {
  const words = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(doneWord))
  for (const word of words) expect(['Steeped', 'Purred', 'Mulled', 'Brewed', 'Drifted']).toContain(word)
  expect(words.size).toBeGreaterThan(2)
  expect(doneWord('msg-1')).toBe(doneWord('msg-1'))
})
