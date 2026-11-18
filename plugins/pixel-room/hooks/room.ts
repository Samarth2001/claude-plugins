// The room's small decisions and its words: what a turn's tool calls came
// to, which sound its end deserves, and how the room speaks of itself in the
// footer, the working line, the summary and the captions. Pure, with no time
// or engine of its own: callers hand in the room as it stands.

import type { Cat, Notes, Phase, RoomView, SceneInput, Weather } from './model'
import { isMoonUp, moonName, weatherWord } from './sky'

export type { Cat, Phase }

/** What the room's words are about: the card's view, or the scene's input. */
export type Room = Pick<RoomView, 'cat' | 'phase' | 'weather' | 'moon' | 'moths' | 'notes'>

/** What the turn's tool calls came to so far. */
export type Outcome = {
  /** Whether the latest tool call errored. */
  lastErrored: boolean
  /** The latest test run's result, if the turn ran one. */
  tests: 'none' | 'passed' | 'failed'
}

/** The sound a turn's end deserves. */
export type Chime = 'finish' | 'failure'

/** Every clip the room plays: a turn's chime, or the cat's purr. */
export type Sound = Chime | 'purr'

export const freshOutcome = (): Outcome => ({ lastErrored: false, tests: 'none' })

/** The outcome after one more tool call: whether it errored, and whether it was a test run. */
export function noteCall(outcome: Outcome, call: { isError: boolean; isTestRun: boolean }): Outcome {
  return {
    lastErrored: call.isError,
    tests: call.isTestRun ? (call.isError ? 'failed' : 'passed') : outcome.tests,
  }
}

/** The sound for a turn's end: none when the person stopped it. */
export function soundFor(outcome: Outcome, ending: { isAborted: boolean; reason: string }): Chime | undefined {
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

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** A count in words up to twelve, in digits past it. */
function count(n: number): string {
  return NUMBERS[n] ?? String(n)
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const isLit = (phase: Phase): boolean => phase !== 'day'

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

/** The moon as a noun: `full moon`, `first-quarter moon`, `waning crescent moon`. */
export function moonWords(moon: number): string {
  const name = moonName(moon)
  if (name.endsWith('moon')) return name
  return name.endsWith('quarter') ? `${name.replace(' ', '-')} moon` : `${name} moon`
}

/** The moon after "The moon is": `full`, `at first quarter`, `a waxing crescent`, `waning gibbous`. */
function moonState(moon: number): string {
  const name = moonName(moon)
  if (name === 'full moon' || name === 'new moon') return name.slice(0, -5)
  if (name.endsWith('quarter')) return `at ${name}`
  return name.endsWith('crescent') ? `a ${name}` : name
}

/** The one quiet footer label: the weather, then the light or the moon. */
export function modeLabel(room: Pick<Room, 'phase' | 'weather' | 'moon'>): string {
  const { phase, weather, moon } = room
  const light =
    phase === 'night' && weather === 'clear' && isMoonUp(phase, weather, moon)
      ? moonName(moon)
      : phase === 'dawn' || phase === 'dusk'
        ? phase
        : phase === 'night'
          ? 'lamp on'
          : 'lamp off'
  return `${weatherWord(weather)} · ${light}`
}

type SpinnerMode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

/** A short phrase for what is outside the window. */
function outside(room: Room): string {
  const { phase, weather, moon } = room
  if (weather === 'snow') return 'Snow on the sill'
  if (phase === 'dawn') return 'First light'
  if (weather === 'clear') {
    if (phase === 'day') return 'Sun on the floorboards'
    return isMoonUp(phase, weather, moon) ? 'Moon over the city' : 'Stars over the city'
  }
  if (weather === 'fog') return 'Fog over the city'
  return weather === 'drizzle' ? 'Drizzle on the glass' : 'Rain on the glass'
}

/** What is going on in the room besides the cat: moths while subagents run, notes while a list runs. */
function happenings(room: Room): string[] {
  const out: string[] = []
  if (room.moths > 0) out.push(isLit(room.phase) ? 'Moths at the lamp' : 'Moths at the screen')
  if (room.notes.open + room.notes.active > 0) out.push('Ticking off a note')
  return out
}

/**
 * The spinner's phrase for a turn, what it is doing and the room as it
 * stands. The caller keeps the first phrase of each turn and mode, so it
 * never changes mid-mode.
 */
export function spinnerPhrase(turn: number, mode: SpinnerMode, room: Room): string {
  const now = happenings(room)
  const list =
    mode === 'tool-use' || mode === 'tool-input'
      ? [...now, "Cat's watching the cursor", 'The cat is watching', 'Tail flicking']
      : mode === 'responding'
        ? ['Pages turning', outside(room), 'Tea going cold', ...now]
        : ['The cat is pacing', outside(room), isLit(room.phase) ? 'The lamp hums' : 'The clock ticks', "Kettle's on", ...now]
  return list[((turn % list.length) + list.length) % list.length] ?? 'Rain on the glass'
}

/** The window in a few words, with the light: `Rain on the glass, the lamp lit`. */
function windowWords(room: Room): string {
  const { phase, weather } = room
  const sky =
    weather === 'rain'
      ? 'Rain on the glass'
      : weather === 'drizzle'
        ? 'A fine drizzle on the glass'
        : weather === 'snow'
          ? 'Snow falling past the window'
          : weather === 'fog'
            ? 'Fog over the city'
            : phase === 'day'
              ? 'A clear sky and a sunbeam on the floor'
              : 'A clear sky over the city'
  const light = phase === 'day' ? 'the lamp off' : phase === 'dusk' ? 'the lamp just lit' : phase === 'dawn' ? 'the lamp still lit' : 'the lamp lit'
  return `${sky}, ${light}`
}

/** The moon, where it can be seen: `A full moon behind the rain.` */
function moonSentence(room: Room): string | undefined {
  const { phase, weather, moon } = room
  if (!isMoonUp(phase, weather, moon)) return undefined
  return `A ${moonWords(moon)} ${weather === 'clear' ? 'over the city' : `behind the ${weather}`}.`
}

function notesSentence(notes: Notes): string | undefined {
  const total = notes.open + notes.active + notes.done
  if (total === 0) return undefined
  const done = notes.done === 0 ? '' : notes.done === total ? (total === 1 ? ', done' : ', all done') : `, ${count(notes.done)} done`
  return `${capital(count(total))} ${total === 1 ? 'note' : 'notes'} on the corkboard${done}.`
}

/** `one moth at the lamp`, `two moths at the screen`. */
function mothsAt(moths: number, phase: Phase): string {
  return `${count(moths)} ${moths === 1 ? 'moth' : 'moths'} at ${isLit(phase) ? 'the lamp' : 'the screen'}`
}

function mothsSentence(moths: number, phase: Phase): string | undefined {
  if (moths <= 0) return undefined
  const where = isLit(phase) ? 'the lamp' : 'the screen'
  return moths === 1 ? `A moth circles ${where}.` : `${capital(count(moths))} moths circle ${where}.`
}

/** Two lines on the room, for `/pixel-room`: outside the window, then inside it. */
export function describeRoom(room: Room): string {
  const outsideLine = [`${windowWords(room)}.`, moonSentence(room)].filter(part => part !== undefined).join(' ')
  const insideLine = [`The cat is ${caption(room.cat)}.`, notesSentence(room.notes), mothsSentence(room.moths, room.phase)]
    .filter(part => part !== undefined)
    .join(' ')
  return `${outsideLine}\n${insideLine}`
}

const TODAY: Record<Weather, string> = { rain: 'rain', drizzle: 'a fine drizzle', snow: 'snow', fog: 'fog', clear: 'clear skies' }

/** The weather as a day has it: `rain`, `a fine drizzle`, `clear skies`. */
export function todayWords(weather: Weather): string {
  return TODAY[weather]
}

/** The day's weather and the moon, for `/pixel-room weather`. */
export function weatherReport(weather: Weather, moon: number, isPinned: boolean): string {
  const first = isPinned
    ? `The weather is pinned to ${weather}. /pixel-room weather auto brings back the day's own.`
    : `${capital(TODAY[weather])} today: the room's own weather, not a forecast.`
  return `${first}\nThe moon is ${moonState(moon)}.`
}

/** What a scene shows, for a reader that cannot see it. */
export function sceneAlt(input: SceneInput): string {
  const { phase, weather, moon } = input
  const when =
    phase === 'night'
      ? 'at night, the desk lamp lit'
      : phase === 'dusk'
        ? 'at dusk, the desk lamp lit'
        : phase === 'dawn'
          ? 'at dawn, the desk lamp still lit'
          : 'by day, the lamp off'
  const sky =
    weather === 'rain'
      ? 'rain on the window'
      : weather === 'drizzle'
        ? 'drizzle on the window'
        : weather === 'snow'
          ? 'snow falling outside'
          : weather === 'fog'
            ? 'fog outside the window'
            : isMoonUp(phase, weather, moon)
              ? `a ${moonWords(moon)} in a clear sky`
              : phase === 'day'
                ? 'sun through the window'
                : 'stars in a clear sky'
  const cat = `a cat ${caption(input.cat)}${input.flourish === 'pet' ? ', purring' : ''}`
  const extras: string[] = []
  if (input.moths > 0) extras.push(mothsAt(input.moths, input.phase))
  const total = input.notes.open + input.notes.active + input.notes.done
  if (total > 0) extras.push(`${count(total)} ${total === 1 ? 'note' : 'notes'} on the corkboard`)
  if (input.flourish === 'plane') extras.push('a paper plane gliding past the window')
  const more = extras.length === 0 ? '' : `, with ${extras.length === 1 ? extras[0] : `${extras.slice(0, -1).join(', ')} and ${extras.at(-1)}`}`
  return `A pixel room ${when}: ${sky} and ${cat}${more}`
}

/** The notes as a tally for the card: `2 of 5 notes done`, or nothing with no list. */
export function notesTally(notes: Notes): string | undefined {
  const total = notes.open + notes.active + notes.done
  return total === 0 ? undefined : `${notes.done} of ${total} ${total === 1 ? 'note' : 'notes'} done`
}

// The room's own words for a finished turn, in place of the terminal's `Baked`.
const DONE_WORDS = ['Steeped', 'Purred', 'Mulled', 'Brewed', 'Drifted'] as const

/** The past-tense word for one turn's closing line: the same for the same line every time it draws. */
export function doneWord(line: string): string {
  let h = 0
  for (let i = 0; i < line.length; i += 1) h = (Math.imul(h, 31) + line.charCodeAt(i)) >>> 0
  return DONE_WORDS[h % DONE_WORDS.length] ?? 'Steeped'
}
