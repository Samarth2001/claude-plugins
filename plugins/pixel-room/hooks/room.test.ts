import { expect, test } from 'claude-code/testing'

import { caption, describeRoom, freshOutcome, isTestCommand, modeLabel, noteCall, phaseAt, roomState, soundFor, spinnerPhrase } from './room'

test('day from 07:00, dusk from 17:00, night from 19:00', () => {
  expect([7, 12, 16].map(phaseAt)).toEqual(['day', 'day', 'day'])
  expect([17, 18].map(phaseAt)).toEqual(['dusk', 'dusk'])
  expect([19, 23, 0, 6].map(phaseAt)).toEqual(['night', 'night', 'night', 'night'])
})

test('the lamp is lit from dusk until morning', () => {
  expect(roomState('asleep', 'night')).toEqual({ cat: 'asleep', phase: 'night', lampOn: true })
  expect(roomState('pacing', 'dusk').lampOn).toBe(true)
  expect(roomState('pacing', 'day').lampOn).toBe(false)
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
  expect(describeRoom(roomState('asleep', 'night'))).toBe('Rain on the glass, the lamp lit. The cat is asleep on the sill.')
  expect(describeRoom(roomState('watching', 'day'))).toBe('Rain on the glass, a grey afternoon. The cat is watching you work.')
  expect(caption('pacing')).toBe('pacing the floorboards')
  expect(modeLabel(roomState('asleep', 'night'))).toBe('raining · lamp on')
  expect(modeLabel(roomState('asleep', 'day'))).toBe('raining · lamp off')
})

test('the spinner keeps one phrase per turn and mode, and tools get the watching ones', () => {
  expect(spinnerPhrase(3, 'thinking')).toBe(spinnerPhrase(3, 'thinking'))
  expect(spinnerPhrase(1, 'tool-use')).toMatch(/watching|Tail/)
  const phrases = new Set([0, 1, 2, 3, 4, 5].map(turn => spinnerPhrase(turn, 'thinking')))
  expect(phrases.size).toBeGreaterThan(1)
  for (const phrase of phrases) expect(phrase.length).toBeLessThan(30)
})
