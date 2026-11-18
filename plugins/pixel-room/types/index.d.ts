// What the room card draws from, held in $.state for the session.
export type RoomCard = {
  /** The cat's pose: asleep, pacing, watching, startled or stretch. */
  cat: 'asleep' | 'pacing' | 'watching' | 'startled' | 'stretch'
  /** The time of day the room shows. */
  phase: 'dawn' | 'day' | 'dusk' | 'night'
  /** Main-loop turns finished this session. */
  turns: number
  /** The plant's mood after the session's latest test run. */
  plant: 'perky' | 'neutral' | 'droopy'
  /** Whether a turn is running. */
  isWorking: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-room': { card: Shaped<RoomCard> }
  }
}
