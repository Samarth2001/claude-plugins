// The room's state and the small decisions about it: the time of day, what a
// turn's tool calls came to, which sound its end deserves, and the words the
// room speaks in. Pure, with no time or engine of its own: callers hand in
// the hour and the events.

import type { Cat, Phase } from './model'

export type { Cat, Phase }

/** What the scene draws. */
export type RoomState = {
  cat: Cat
  phase: Phase
  lampOn: boolean
}

/** What the turn's tool calls came to so far. */
export type Outcome = {
  /** Whether the latest tool call errored. */
  lastErrored: boolean
  /** The latest test run's result, if the turn ran one. */
  tests: 'none' | 'passed' | 'failed'
}

export type Sound = 'finish' | 'failure'

/** Day from 07:00, dusk from 17:00, night from 19:00, local time. */
export function phaseAt(hour: number): Phase {
  if (hour >= 19 || hour < 7) return 'night'
  return hour >= 17 ? 'dusk' : 'day'
}

/** The lamp is lit from dusk until morning. */
export function roomState(cat: Cat, phase: Phase): RoomState {
  return { cat, phase, lampOn: phase !== 'day' }
}

export const freshOutcome = (): Outcome => ({ lastErrored: false, tests: 'none' })

/** The outcome after one more tool call: whether it errored, and whether it was a test run. */
export function noteCall(outcome: Outcome, call: { isError: boolean; isTestRun: boolean }): Outcome {
  return {
    lastErrored: call.isError,
    tests: call.isTestRun ? (call.isError ? 'failed' : 'passed') : outcome.tests,
  }
}

/** The sound for a turn's end: none when the person stopped it. */
export function soundFor(outcome: Outcome, ending: { isAborted: boolean; reason: string }): Sound | undefined {
  if (ending.isAborted || ending.reason === 'aborted') return undefined
  if (ending.reason === 'error' || ending.reason === 'refusal') return 'failure'
  return outcome.lastErrored || outcome.tests === 'failed' ? 'failure' : 'finish'
}

// Test runners as the words that start them. A pattern ending in `*` matches any word with that start.
const RUNNERS: readonly (readonly string[])[] = [
  ['npm', 'test'], ['npm', 't'], ['npm', 'run', 'test*'], ['pnpm', 'test'], ['pnpm', 'run', 'test*'],
  ['yarn', 'test'], ['yarn', 'run', 'test*'], ['bun', 'test'], ['bun', 'run', 'test*'], ['deno', 'test'],
  ['vitest'], ['jest'], ['mocha'], ['ava'], ['playwright', 'test'],
  ['pytest'], ['py.test'], ['tox'], ['nox'], ['python*', '-m', 'pytest'], ['python*', '-m', 'unittest'], ['py', '-m', 'pytest'],
  ['cargo', 'test'], ['cargo', 'nextest'], ['go', 'test'], ['dotnet', 'test'], ['mvn', 'test'], ['mvn', 'verify'],
  ['gradle', 'test'], ['./gradlew', 'test'], ['gradlew', 'test'], ['rspec'], ['rake', 'test'], ['mix', 'test'],
  ['phpunit'], ['ctest'], ['make', 'test'], ['make', 'check'], ['swift', 'test'], ['zig', 'build', 'test'],
  ['invoke-pester'], ['claude', 'plugin', 'test'],
]

function fits(pattern: string, word: string): boolean {
  return pattern.endsWith('*') ? word.startsWith(pattern.slice(0, -1)) : word === pattern
}

/** Whether a shell command runs a test suite, once, in the foreground. */
export function isTestCommand(command: string): boolean {
  const words = command
    .toLowerCase()
    .split(/[\s'"`;&|()<>]+/)
    .filter(word => word !== '')
  if (words.some(word => word.startsWith('--watch') || word === '--help' || word === '--version')) return false
  // `npx vitest`, `/usr/bin/pytest` and `node_modules/.bin/jest` run the same runner.
  const names = words
    .filter(word => word !== 'npx' && word !== 'bunx' && word !== 'uv' && word !== 'poetry')
    .map(word => (word.startsWith('./') ? word : word.slice(word.lastIndexOf('/') + 1)))
  return names.some((_, start) =>
    RUNNERS.some(runner => runner.every((pattern, offset) => fits(pattern, names[start + offset] ?? ''))),
  )
}

// ---------------------------------------------------------------- the room's voice

/** Where the cat is and what it's doing, as a caption. */
export function caption(cat: Cat): string {
  switch (cat) {
    case 'asleep':
      return 'asleep on the sill'
    case 'pacing':
      return 'pacing the floorboards'
    case 'watching':
      return 'watching you work'
    case 'startled':
      return 'startled by a thud'
    case 'stretch':
      return 'stretching, then curling up'
  }
}

/** The one quiet footer label. */
export function modeLabel(state: RoomState): string {
  if (state.phase === 'day') return 'raining · lamp off'
  return state.phase === 'dusk' ? 'raining · dusk' : 'raining · lamp on'
}

type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

// Short phrases about the room, by what the turn is doing. Each turn picks one per mode.
const PHRASES: Record<'quiet' | 'tools' | 'words', readonly string[]> = {
  quiet: ['The cat is pacing', 'Rain on the glass', 'The lamp hums', 'Kettle\'s on'],
  tools: ['Cat\'s watching the cursor', 'The cat is watching', 'Tail flicking'],
  words: ['Pages turning', 'Rain on the glass', 'Tea going cold'],
}

/** The spinner's phrase for a turn and what it is doing; the same all turn long. */
export function spinnerPhrase(turn: number, mode: SpinnerMode): string {
  const list = mode === 'tool-use' || mode === 'tool-input' ? PHRASES.tools : mode === 'responding' ? PHRASES.words : PHRASES.quiet
  return list[((turn % list.length) + list.length) % list.length] ?? 'Rain on the glass'
}

/** A few lines on the room, for `/pixel-room`. */
export function describeRoom(state: RoomState): string {
  const window =
    state.phase === 'night' ? 'Rain on the glass, the lamp lit.' : state.phase === 'dusk' ? 'Rain at dusk, the lamp just lit.' : 'Rain on the glass, a grey afternoon.'
  return `${window} The cat is ${caption(state.cat)}.`
}
