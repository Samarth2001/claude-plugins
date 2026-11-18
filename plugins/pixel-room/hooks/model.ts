// What the room is drawn from: the shared vocabulary of the scene and the
// card. Plain data, no logic. register.tsx gathers a SceneInput from
// the clock and Claude's events; every drawing module reads it and nothing
// else, so each stays pure and deterministic for its input.

export type Cat = 'asleep' | 'pacing' | 'watching' | 'startled' | 'stretch'

/** Dawn 05:00 to 07:00, day to 17:00, dusk to 19:00, night until dawn, local time. */
export type Phase = 'dawn' | 'day' | 'dusk' | 'night'

/** The day's weather outside the window. */
export type Weather = 'rain' | 'drizzle' | 'snow' | 'fog' | 'clear'

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

/** What the desk monitor shows: a screensaver, code at work, a red line, a green check. */
export type Monitor = 'idle' | 'working' | 'error' | 'done'

/** Claude's todo list as sticky notes: how many are waiting, under way and done. All zero means no list. */
export type Notes = { open: number; active: number; done: number }

/**
 * A one-shot that plays once as the scene loads, then rests out of sight:
 * a paper plane over the city after a `git push`, hearts over the cat after
 * a pet. `none` the rest of the time.
 */
export type Flourish = 'none' | 'plane' | 'pet'

/** The local date, for the desk calendar and the season. */
export type LocalDate = {
  /** 0 for January. */
  month: number
  /** 1 to 31. */
  day: number
  /** 0 for Sunday. */
  weekday: number
}

/** The local time the wall clock shows when the scene loads. */
export type Clock = { hour: number; minute: number; second: number }

/** Everything the backdrop draws. */
export type SceneInput = {
  cat: Cat
  phase: Phase
  /** Lit from dusk until the morning's day phase: dusk, night and dawn. */
  lampOn: boolean
  weather: Weather
  season: Season
  /** The moon's phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter; in steps of 1/16. */
  moon: number
  monitor: Monitor
  /** Moths circling the lit lamp (the monitor by day): one per running subagent, 0 to 3. */
  moths: number
  notes: Notes
  flourish: Flourish
  date: LocalDate
  isWorking: boolean
}

export type Plant = 'perky' | 'neutral' | 'droopy'

/** What the room card draws: held in $.state for the session. */
export type RoomView = {
  cat: Cat
  phase: Phase
  weather: Weather
  /** As SceneInput's. */
  moon: number
  /** Main-loop turns finished this session. */
  turns: number
  plant: Plant
  isWorking: boolean
  moths: number
  notes: Notes
  /** A one-shot the card plays once while it is set: hearts after a pet, a paper plane after a push. */
  flourish: Flourish
}

export const NO_NOTES: Notes = { open: 0, active: 0, done: 0 }
