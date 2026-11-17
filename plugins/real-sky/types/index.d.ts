export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
export type Weather = 'clear' | 'cloudy' | 'storm'

/** What the sky shows, as the theme was last set. */
export type Sky = {
  isOn: boolean
  /** Pinned with /real-sky rather than following the clock. */
  isPinned: boolean
  phase: Phase
  /** How far through the part of the day, in small steps from 0 to 1. */
  step: number
  weather: Weather
  hour: number
  minute: number
  /** Days since the last new moon, from 0 to just under 29.53. */
  moonAge: number
  /** The local date, such as `Tue 17 Nov`. */
  date: string
}

/** The session barometer: what the turns have said so far. */
export type Log = {
  /** Main-loop turns finished. */
  turns: number
  /** Turns in a row that ended clean. */
  clear: number
  /** Errors so far in the turn that runs. */
  errors: number
  /** Errors in the last turn that finished. */
  lastErrors: number
  /** A test run failed in the turn that runs. */
  testFailed: boolean
  /** The needle: 0 is stormy, 1 very dry. */
  pressure: number
  /** The reading when the turn that runs began. */
  setHand: number
}

declare module 'claude-code' {
  interface PluginState {
    'real-sky': {
      sky: Shaped<Sky | null>
      log: Shaped<Log>
      /** The almanac has been opened unasked once this session. */
      offered: boolean
    }
  }
}
