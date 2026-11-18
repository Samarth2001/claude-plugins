// What is outside the window, worked out from the local date and clock
// alone: the time of day, the season (turned around south of the equator),
// the day's weather, and the moon's real phase. Pure: callers hand in the
// date, the hour and the time zone's name.

import type { Phase, Season, Weather } from './model'

/** Dawn from 05:00, day from 07:00, dusk from 17:00, night from 19:00, local time. */
export function phaseAt(hour: number): Phase {
  if (hour >= 19 || hour < 5) return 'night'
  if (hour < 7) return 'dawn'
  return hour >= 17 ? 'dusk' : 'day'
}

// Time zones south of the equator, where December is summer. A zone not
// named here is taken to be northern.
const SOUTHERN = [
  /^Australia\//,
  /^Antarctica\//,
  /^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Port_Moresby|Tahiti|Rarotonga)$/,
  /^America\/(Sao_Paulo|Argentina\/.+|Buenos_Aires|Santiago|Montevideo|Asuncion|Lima|La_Paz|Punta_Arenas|Campo_Grande|Cuiaba|Porto_Velho|Recife|Bahia|Fortaleza|Maceio|Belem|Araguaina)$/,
  /^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Blantyre|Lubumbashi|Luanda)$/,
  /^Indian\/(Mauritius|Reunion|Antananarivo)$/,
  /^Atlantic\/(Stanley|South_Georgia)$/,
]

/** Whether a time zone's name puts it south of the equator. */
export function isSouthernZone(zone: string | undefined): boolean {
  return zone !== undefined && SOUTHERN.some(pattern => pattern.test(zone))
}

const NORTH: readonly Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']
const OPPOSITE: Record<Season, Season> = { winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' }

/** The season of a month (0 for January): meteorological, three months each. */
export function seasonOf(month: number, isSouthern = false): Season {
  const north = NORTH[((month % 12) + 12) % 12] ?? 'autumn'
  return isSouthern ? OPPOSITE[north] : north
}

// How often each weather comes in each season, out of 100. Rain is the room's
// own weather, so it is never rare.
const ODDS: Record<Season, readonly [Weather, number][]> = {
  winter: [['rain', 35], ['snow', 35], ['fog', 15], ['clear', 15]],
  spring: [['rain', 45], ['drizzle', 25], ['clear', 20], ['fog', 10]],
  summer: [['rain', 35], ['clear', 45], ['drizzle', 20]],
  autumn: [['rain', 50], ['drizzle', 20], ['fog', 20], ['clear', 10]],
}

/** A number in [0, 100) fixed for a date: the same all day, different the next. */
function roll(year: number, month: number, day: number): number {
  let h = (year * 372 + month * 31 + day) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h % 100
}

/** The weather for a local date: the same all day. */
export function weatherFor(date: { year: number; month: number; day: number }, season: Season): Weather {
  let left = roll(date.year, date.month, date.day)
  for (const [weather, odds] of ODDS[season]) {
    if (left < odds) return weather
    left -= odds
  }
  return 'rain'
}

/** A new moon, 2000-01-06 18:14 UTC, and the mean synodic month. */
const NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14)
const SYNODIC_MS = 29.530588853 * 86_400_000

/** The moon's phase at a moment: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter, in steps of 1/16. */
export function moonPhase(ms: number): number {
  const age = (((ms - NEW_MOON_MS) % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS
  return (Math.round((age / SYNODIC_MS) * 16) % 16) / 16
}

/** The moon's phase in words. */
export function moonName(moon: number): string {
  const step = Math.round((((moon % 1) + 1) % 1) * 16) % 16
  if (step === 0) return 'new moon'
  if (step < 4) return 'waxing crescent'
  if (step === 4) return 'first quarter'
  if (step < 8) return 'waxing gibbous'
  if (step === 8) return 'full moon'
  if (step < 12) return 'waning gibbous'
  if (step === 12) return 'last quarter'
  return 'waning crescent'
}

/** Whether the moon can be seen: up from dusk to dawn, and not in fog or at new moon. */
export function isMoonUp(phase: Phase, weather: Weather, moon: number): boolean {
  return phase !== 'day' && weather !== 'fog' && moonName(moon) !== 'new moon'
}

/** One word for the weather, as the footer and the room's lines say it. */
export function weatherWord(weather: Weather): string {
  switch (weather) {
    case 'rain':
      return 'raining'
    case 'drizzle':
      return 'drizzle'
    case 'snow':
      return 'snowing'
    case 'fog':
      return 'foggy'
    case 'clear':
      return 'clear'
  }
}
