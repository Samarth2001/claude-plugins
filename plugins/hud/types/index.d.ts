export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

// What $.session.usage() and session.measure last reported.
export type Snapshot = {
  percent?: number
  tokens?: number
  window: number
  usd?: number
  limits: Limit[]
}

// One finished main-loop turn, oldest first.
export type Turn = {
  n: number
  ms: number
  tools: number
  percent: number
  tokens: number
  usd?: number
  cacheHit?: number
  isAborted: boolean
}

// Token counts summed over every turn this session, subagents included.
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number; subagent: number }

// What is happening right now. Times are $.clock.now() milliseconds.
export type Live = {
  isWorking: boolean
  turnStartedAt: number
  toolsThisTurn: number
  usdAtTurnStart?: number
  model: string
  tools: Record<string, number>
  tokens: Tokens
  // Until when each unit glows after it changed.
  flash: { context: number; limits: number; cost: number }
  // The readings before the last change, so a gauge can slide from them.
  previous: { percent?: number; limits: Record<string, number> }
}

// Spend per local day (YYYY-MM-DD) across every session this machine ran.
export type Ledger = { days: Record<string, number>; since?: string }

export type Mode = 'glance' | 'detail' | 'hidden'
export type Tab = 'context' | 'limits' | 'cost' | 'turns'
export type Range = 'week' | 'month' | 'year'
export type View = { mode: Mode; tab: Tab; range: Range }

declare module 'claude-code' {
  interface PluginState {
    hud: {
      snapshot: Snapshot | null
      turns: Turn[]
      live: Live
      ledger: Ledger
      view: View
    }
  }
}
