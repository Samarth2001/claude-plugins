// The almanac's arithmetic: which part of the day a local clock reading falls
// in and how far through it, where the sun or moon stands on its arc, the
// moon's phase on a date, what the session's tool calls make of the weather,
// and the barometer they move. Pure: the clock and the calls come in as values.

import type { Log, Phase, Weather } from '../types'

export type { Log, Phase, Weather }

export const PHASES: readonly Phase[] = ['dawn', 'day', 'dusk', 'night']

/** Where each part of the day starts, in local hours; night runs past midnight to dawn. */
export const STARTS: Record<Phase, number> = { dawn: 5, day: 8, dusk: 17, night: 20 }
export const NEXT: Record<Phase, Phase> = { dawn: 'day', day: 'dusk', dusk: 'night', night: 'dawn' }

/** How many places the sun or moon takes across one part of the day. */
export const STEPS = 24

const lengthOf = (phase: Phase) => (STARTS[NEXT[phase]] - STARTS[phase] + 24) % 24

/** The part of the day at a local hour (0 to 23) and minute. */
export function phaseAt(hour: number, minute = 0): Phase {
  const at = hour + minute / 60
  if (at >= STARTS.dawn && at < STARTS.day) return 'dawn'
  if (at >= STARTS.day && at < STARTS.dusk) return 'day'
  if (at >= STARTS.dusk && at < STARTS.night) return 'dusk'
  return 'night'
}

/** How far through its part of the day a local hour and minute is, from 0 to just under 1. */
export function progressAt(hour: number, minute = 0): number {
  const phase = phaseAt(hour, minute)
  const into = (hour + minute / 60 - STARTS[phase] + 24) % 24
  return Math.min(Math.max(into / lengthOf(phase), 0), 1)
}

/** The progress rounded to one of STEPS places, so the sky moves in small, rare steps. */
export function stepOf(progress: number): number {
  return Math.round(progress * STEPS) / STEPS
}

/** The local clock reading a part of the day and a progress through it stand for. */
export function timeAt(phase: Phase, progress: number): { hour: number; minute: number } {
  const minutes = Math.round((STARTS[phase] + lengthOf(phase) * Math.min(Math.max(progress, 0), 1)) * 60) % (24 * 60)
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 }
}

/**
 * Where the body on the arc stands, from 0 at its left foot to 1 at its right:
 * the sun crosses from 05:00 to 20:00, dawn to the end of dusk, and the moon
 * crosses the same arc through the night.
 */
export function arcAt(phase: Phase, progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1)
  if (phase === 'night') return p
  const start = STARTS[phase] - STARTS.dawn
  return (start + lengthOf(phase) * p) / 15
}

/** The local hour and minute of an epoch time, in this machine's time zone. */
export function localTime(ms: number): { hour: number; minute: number } {
  const date = new Date(ms)
  return { hour: date.getHours(), minute: date.getMinutes() }
}

/** A local time as `HH:MM`. */
export function clockText(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The local date of an epoch time, as `Tue 17 Nov`. */
export function dateText(ms: number): string {
  const date = new Date(ms)
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

// The moon --------------------------------------------------------------------

/** The mean synodic month, new moon to new moon, in days. */
export const SYNODIC = 29.530588853
/** A new moon to count from: 6 January 2000, 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

/** Days since the last new moon at an epoch time, from 0 to just under SYNODIC. */
export function moonAge(ms: number): number {
  const days = (ms - NEW_MOON) / 86_400_000
  return ((days % SYNODIC) + SYNODIC) % SYNODIC
}

/** The lit fraction of the moon's face at an age, from 0 (new) to 1 (full). */
export function moonLit(age: number): number {
  return (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2
}

/** Whether the lit side is growing: the first half of the month. */
export const isWaxing = (age: number) => age < SYNODIC / 2

export const MOON_NAMES = [
  'new moon',
  'waxing crescent',
  'first quarter',
  'waxing gibbous',
  'full moon',
  'waning gibbous',
  'last quarter',
  'waning crescent',
] as const

/** The phase's name at an age, each named phase centred on its moment. */
export function moonName(age: number): (typeof MOON_NAMES)[number] {
  return MOON_NAMES[Math.floor((age / SYNODIC) * 8 + 0.5) % 8] ?? 'new moon'
}

// The weather -----------------------------------------------------------------

/** What one turn's tool calls said. */
export type Tally = {
  /** Calls that came back as errors. */
  errors: number
  /** The last test command passed. */
  passed: boolean
  /** The last test command failed. */
  testFailed: boolean
}

export const emptyTally = (): Tally => ({ errors: 0, passed: false, testFailed: false })

/** How heavy a weather is, to compare two. */
export const SEVERITY: Record<Weather, number> = { clear: 0, cloudy: 1, storm: 2 }

/** Errors in one turn that make a storm. */
export const STORM_ERRORS = 3

/** The weather a turn's calls make: a passing test clears it, a failing one or many errors storm. */
export function weatherOf(tally: Tally): Weather {
  if (tally.passed) return 'clear'
  if (tally.testFailed || tally.errors >= STORM_ERRORS) return 'storm'
  if (tally.errors > 0) return 'cloudy'
  return 'clear'
}

const RUNNERS = [
  'npm test', 'npm t', 'npm run test*', 'pnpm test', 'pnpm run test*', 'yarn test*', 'yarn run test*', 'bun test',
  'bun run test*', 'vitest', 'jest', 'pytest', 'python -m pytest', 'python3 -m pytest', 'python -m unittest',
  'python3 -m unittest', 'go test', 'cargo test', 'cargo nextest', 'deno test', 'dotnet test', 'mvn test',
  'gradle test', './gradlew test', 'rspec', 'phpunit', 'mix test', 'ctest', 'make test', 'claude plugin test',
].map(runner => runner.split(' '))

const fits = (pattern: string, word: string) =>
  pattern.endsWith('*') ? word === pattern.slice(0, -1) || word.startsWith(`${pattern.slice(0, -1)}:`) : word === pattern

/** Whether a shell command line runs a test suite (see RUNNERS above). */
export function isTestCommand(command: string): boolean {
  const words = command
    .toLowerCase()
    .split(/[\s'"`;&|()<>]+/)
    .filter(word => word !== '')
  if (words.some(word => word.startsWith('--watch') || word === '--help' || word === '--version')) return false
  const names = words.map(word => (word === './gradlew' ? word : word.slice(word.lastIndexOf('/') + 1)))
  return names.some((_, start) =>
    RUNNERS.some(runner => runner.every((pattern, offset) => fits(pattern, names[start + offset] ?? ''))),
  )
}

// The barometer ---------------------------------------------------------------

/** Where the needle rests before the first turn: between change and fair. */
export const SETTLED = 0.62

export const emptyLog = (): Log => ({
  turns: 0,
  clear: 0,
  errors: 0,
  lastErrors: 0,
  testFailed: false,
  pressure: SETTLED,
  setHand: SETTLED,
})

const clamp = (value: number) => Math.round(Math.min(0.96, Math.max(0.04, value)) * 1000) / 1000

/** An error mid-turn: the needle falls, and further for a failed test run. */
export function logError(log: Log, isTest = false): Log {
  return {
    ...log,
    errors: log.errors + 1,
    testFailed: log.testFailed || isTest,
    pressure: clamp(log.pressure - (isTest ? 0.18 : 0.09)),
  }
}

/** A turn ends: a clean one lifts the needle, a passing test run more, and the set hand follows it. */
export function logTurn(log: Log, tally: Tally): Log {
  const isClean = tally.passed || tally.errors === 0
  const pressure = clamp(log.pressure + (tally.passed ? 0.14 : isClean ? 0.07 : 0))
  return {
    turns: log.turns + 1,
    clear: isClean ? log.clear + 1 : 0,
    errors: 0,
    lastErrors: tally.errors,
    testFailed: false,
    pressure,
    setHand: pressure,
  }
}

export type Zone = 'stormy' | 'rain' | 'change' | 'fair' | 'very dry'

/** The word an aneroid dial prints where the needle points. */
export function zoneOf(pressure: number): Zone {
  if (pressure < 0.22) return 'stormy'
  if (pressure < 0.42) return 'rain'
  if (pressure < 0.58) return 'change'
  if (pressure < 0.82) return 'fair'
  return 'very dry'
}
