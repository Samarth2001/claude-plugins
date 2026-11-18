// What the room card draws from, held in $.state
// for the session. A contract stands alone, so this repeats hooks/model.ts's
// RoomView field for field; register.tsx fails to compile if the two part.

export type RoomCard = {
  /** The cat's pose; a stretch is shown asleep. */
  cat: 'asleep' | 'pacing' | 'watching' | 'startled' | 'stretch'
  /** The time of day the room shows. */
  phase: 'dawn' | 'day' | 'dusk' | 'night'
  /** The weather outside the window: the day's own, or the one pinned. */
  weather: 'rain' | 'drizzle' | 'snow' | 'fog' | 'clear'
  /** The moon's phase: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter; in steps of 1/16. */
  moon: number
  /** Main-loop turns finished this session. */
  turns: number
  /** The plant's mood after the session's latest test run. */
  plant: 'perky' | 'neutral' | 'droopy'
  /** Whether a turn is running. */
  isWorking: boolean
  /** Moths at the lamp: subagents running, 0 to 3. */
  moths: number
  /** Claude's todo list as notes: how many are waiting, under way and done. */
  notes: { open: number; active: number; done: number }
  /** A one-shot the card plays once while it is set: hearts after a pet, a paper plane after a push. */
  flourish: 'none' | 'plane' | 'pet'
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-room': { card: Shaped<RoomCard> }
  }
}
