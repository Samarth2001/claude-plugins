// The almanac's words: the spinner's phrase, the footer's label, the
// barometer's forecast and what /real-sky says. Short, plain, in the voice of
// a log kept by a window. Pure.

import { NEXT, STARTS, clockText, moonLit, moonName, zoneOf } from './phase'
import type { Log, Phase, Weather } from './phase'
import type { Sky } from '../types'

const WEATHER_WORDS: Record<Weather, string> = { clear: 'clear sky', cloudy: 'overcast', storm: 'storm' }

const CLEAR: Record<Phase, readonly string[]> = {
  dawn: ['Waiting on first light', 'Watching the east', 'Reading the sky'],
  day: ['Reading the sky', 'Following the sun', 'Taking a sighting', 'Noting the hour'],
  dusk: ['Watching the light go', 'Logging the sunset', 'Marking the dusk'],
  night: ['Counting stars', 'Charting the moon', 'Keeping the night watch'],
}
const CLOUDY: readonly string[] = ['Reading the clouds', 'Waiting for a break', 'Watching the front']
const STORM: readonly string[] = ['Riding out the storm', 'Waiting out the rain', 'Holding the course']

/** The phrases the spinner draws from under a sky. */
export function phrasesFor(phase: Phase, weather: Weather): readonly string[] {
  return weather === 'storm' ? STORM : weather === 'cloudy' ? CLOUDY : CLEAR[phase]
}

/** A small stable hash of a string. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** The spinner's phrase: one of the sky's, sampled once per turn. */
export function spinnerWord(phase: Phase, weather: Weather, turn: number, seed: string): string {
  const phrases = phrasesFor(phase, weather)
  return phrases[hash(`${seed}:${turn}`) % phrases.length] ?? 'Reading the sky'
}

/** The footer's label, as `dusk · clear`. */
export const modeLabel = (phase: Phase, weather: Weather) => `${phase} · ${weather}`

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The barometer's one line. */
export function forecast(log: Log, weather: Weather): string {
  if (log.errors > 0) {
    if (log.testFailed) return 'Storm. A test run failed.'
    if (weather === 'storm') return `Storm. ${plural(log.errors, 'error')} this turn.`
    return `Pressure falling, ${plural(log.errors, 'error')} this turn.`
  }
  if (log.turns === 0) return 'Settled. Nothing logged yet.'
  if (log.clear > 0) return `Fair. ${plural(log.clear, 'turn')} clear.`
  return `Unsettled. ${plural(log.lastErrors, 'error')} last turn.`
}

/** The barometer in a word, for the glance: where the needle points, or `falling` mid-turn. */
export const glanceWord = (log: Log) => (log.errors > 0 ? 'falling' : zoneOf(log.pressure))

/** When the next part of the day begins, as `night at 20:00`. */
export const nextChange = (phase: Phase) => `${NEXT[phase]} at ${clockText(STARTS[NEXT[phase]], 0)}`

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** The moon in words, as `waxing gibbous, 72% lit`. */
export const moonText = (age: number) => `${moonName(age)}, ${Math.round(moonLit(age) * 100)}% lit`

/** The sky in one line, as `Dusk, 18:20. Clear sky; night at 20:00.` */
export function skyLine(sky: Sky): string {
  return `${capital(sky.phase)}, ${clockText(sky.hour, sky.minute)}. ${capital(WEATHER_WORDS[sky.weather])}; ${nextChange(sky.phase)}.`
}

/** What /real-sky says with no words after it: the sky, the moon and the barometer. */
export function summary(sky: Sky, log: Log): string[] {
  const said = forecast(log, sky.weather)
  return [skyLine(sky), `Moon: ${moonText(sky.moonAge)}.`, `Barometer: ${said.charAt(0).toLowerCase()}${said.slice(1)}`]
}
