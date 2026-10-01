export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snapshot = {
  percent?: number
  tokens?: number
  window: number
  lastTurnAdded?: number
  usd?: number
  limits: Limit[]
}

declare module 'claude-code' {
  interface PluginState {
    buddy: { snapshot: Snapshot | null; isHidden: boolean }
  }
}
