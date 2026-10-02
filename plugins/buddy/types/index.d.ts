export type Mood =
  | 'idle'
  | 'sleeping'
  | 'thinking'
  | 'reading'
  | 'editing'
  | 'running'
  | 'browsing'
  | 'delegating'
  | 'working'
  | 'done'
  | 'error'
  | 'full'

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  percent?: number
  tokens?: number
  window: number
  usd?: number
  limits: Limit[]
}

// One context reading per finished turn, oldest first: the sparkline.
export type Reading = { percent: number; tokens: number }

export type Activity = { mood: Mood; verb: string; target?: string }

// What the session is doing right now. Times are $.clock.now() milliseconds.
export type Live = {
  turnStartedAt: number
  lastActiveAt: number
  toolsThisTurn: number
  doneUntil: number
  errorUntil: number
  activity: Activity | null
  lastTurn: { ms: number; tools: number } | null
  model: string
  files: string[]
}

declare module 'claude-code' {
  interface PluginState {
    buddy: {
      snapshot: Snapshot | null
      readings: Reading[]
      live: Live
      isHidden: boolean
      isCompact: boolean
    }
  }
}
