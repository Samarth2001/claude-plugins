import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Ledger, Limit, Live, Snapshot, Tab, Turn, View } from '../types'
import { LIMIT_LABELS, addDays, cacheHit, dayKey, formatSpan, toolGroup } from './calc'
import { FLASH_MS, dashboard, drawer, glance } from './draw'
import type { Actions, Data } from './draw'

const IDLE: Live = {
  isWorking: false,
  turnStartedAt: 0,
  toolsThisTurn: 0,
  model: '',
  tools: {},
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, subagent: 0 },
  flash: { context: 0, limits: 0, cost: 0 },
  previous: { limits: {} },
}
const DEFAULT_VIEW: View = { mode: 'glance', tab: 'limits', range: 'week' }

const snapshot = atom({ plugin: 'hud', key: 'snapshot' } as const, null)
const turns = atom({ plugin: 'hud', key: 'turns' } as const, [])
const live = atom({ plugin: 'hud', key: 'live' } as const, IDLE)
const ledger = atom({ plugin: 'hud', key: 'ledger' } as const, { days: {} })
const view = atom({ plugin: 'hud', key: 'view' } as const, DEFAULT_VIEW)

const PANE = 'hud'
const HISTORY = 40
const TICK_MS = 140
// Off the terminal, motion runs inside the drawings, so a turn redraws only as
// often as its clock changes: each redraw may reload every drawing.
const VECTOR_TICK_MS = 1000
const IDLE_REDRAW_MS = 20_000

const LEDGER_REFRESH_MS = 5 * 60_000
const KEEP_DAYS = 400
const ALERTS = [80, 95]
const TABS: Tab[] = ['context', 'limits', 'cost', 'turns']

// $.store keys. Each session writes only its own `spent:` keys, so sessions
// running side by side never overwrite each other's spend.
const VIEW_KEY = 'view'
const SINCE_KEY = 'since'
const spentKey = (day: string, session: string) => `spent:${day}:${session}`
const seenKey = (session: string) => `seen:${session}`

type $ = EngineInterface

function toSnapshot(usage: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Snapshot {
  return {
    percent: usage.context.percent,
    tokens: usage.context.tokens,
    window: usage.context.window,
    usd: usage.cost?.usd,
    limits: usage.rateLimits.map(({ kind, percentUsed, resetsAt }): Limit => ({ kind, percentUsed, resetsAt })),
  }
}

// Sums every session's spend per day from the store, dropping old days and
// the last-seen totals of sessions not heard from since then.
async function loadLedger($: $, now: number): Promise<Ledger> {
  const oldest = addDays(dayKey(now), -KEEP_DAYS)
  const days: Record<string, number> = {}
  const keys = (await $.store.keys()).filter(key => key.startsWith('spent:') || key.startsWith('seen:'))
  const values = await Promise.all(keys.map(key => $.store.get(key)))
  const stale: string[] = []
  keys.forEach((key, i) => {
    const value = values[i]
    if (key.startsWith('seen:')) {
      const day = (value as { day?: string } | undefined)?.day
      if (day !== undefined && day < oldest) stale.push(key)
      return
    }
    const day = key.slice(6, 16)
    if (day < oldest) return void stale.push(key)
    const usd = Number(value)
    if (Number.isFinite(usd)) days[day] = (days[day] ?? 0) + usd
  })
  await Promise.all(stale.map(key => $.store.delete(key)))
  let since = (await $.store.get(SINCE_KEY)) as string | undefined
  if (since === undefined) {
    since = Object.keys(days).sort()[0] ?? dayKey(now)
    await $.store.set(SINCE_KEY, since)
  }
  return { days, since }
}

// Session-scoped bookkeeping; a reload starts it over, which costs at most a
// repeated toast.
let costQueue: Promise<void> = Promise.resolve()
const alerted = new Set<string>()
let isFirstMeasure = true
// Whether the chips should be tinted for a light theme; read at session start.
let isLight = false

async function readTheme($: $): Promise<boolean> {
  try {
    const row = (await $.config.list()).find(r => r.key === 'theme')
    return typeof row?.value === 'string' && row.value.includes('light')
  } catch {
    return false
  }
}

// Adds what this session spent since the last reading to today's bucket.
function recordCost($: $, usd: number): Promise<void> {
  costQueue = costQueue.then(async () => {
    const session = await $.session.id()
    const now = await $.clock.now()
    const day = dayKey(now)
    const seen = (await $.store.get(seenKey(session))) as { usd: number } | undefined
    // A total lower than last seen is a fresh ledger (a /clear): count it whole.
    const delta = seen === undefined || usd < seen.usd ? usd : usd - seen.usd
    await $.store.set(seenKey(session), { usd, day })
    if (delta <= 0) return
    const key = spentKey(day, session)
    await $.store.set(key, Number((await $.store.get(key)) ?? 0) + delta)
    await update($, ledger, l => ({ ...l, days: { ...l.days, [day]: (l.days[day] ?? 0) + delta } }))
  }).catch(() => {})
  return costQueue
}

// Toasts once when a window crosses 80% and 95%. The first reading of a
// session only notes what is already past, so a restart stays quiet.
function checkAlerts($: $, limits: Limit[], now: number): void {
  for (const limit of limits) {
    for (const threshold of ALERTS) {
      const id = `${limit.kind}:${limit.resetsAt ?? ''}:${threshold}`
      if (limit.percentUsed < threshold || alerted.has(id)) continue
      alerted.add(id)
      if (isFirstMeasure) continue
      const resets = limit.resetsAt ? `, resets in ${formatSpan(Date.parse(limit.resetsAt) - now)}` : ''
      $.ui.toast(`HUD: ${LIMIT_LABELS[limit.kind] ?? limit.kind} limit at ${Math.round(limit.percentUsed)}%${resets}`, { timeoutMs: 6000 })
    }
  }
  isFirstMeasure = false
}

async function setView($: $, change: Partial<View>): Promise<void> {
  await update($, view, v => ({ ...v, ...change }))
  await $.store.set(VIEW_KEY, await read($, view))
}

function actions($: $): Actions {
  return {
    setView: change => void setView($, change),
    openPane: () => void $.ui.open({ id: PANE, title: 'HUD', columns: 96 }),
  }
}

async function data($: $, snap: Snapshot): Promise<Data> {
  const now = await $.clock.now()
  return {
    snap,
    turns: await read($, turns),
    live: await read($, live),
    ledger: await read($, ledger),
    view: await read($, view),
    now,
    today: dayKey(now),
    isLight,
  }
}

export const register: Register = on => {
  // Redraw pacing only; everything drawn comes from $.state.
  let isAnimating = false
  let lastDraw = 0
  // When a terminal last drew the band or the pane; until one does, the
  // drawings animate themselves and a turn redraws once a second.
  let lastTerminalDraw = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'hud',
      description: 'Usage cockpit: "/hud" opens the dashboard and brings back a hidden band; glance, detail, hide or show sets the band',
    })
    const now = await $.clock.now()
    isLight = await readTheme($)
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    const model = await $.session.model()
    await update($, live, l => ({ ...l, model }))
    const saved = (await $.store.get(VIEW_KEY)) as Partial<View> | undefined
    if (saved) await update($, view, v => ({ ...v, ...saved }))
    const loaded = await loadLedger($, now)
    await update($, ledger, () => loaded)
    checkAlerts($, usage.rateLimits, now)

    $.clock.every(TICK_MS, () => {
      void (async () => {
        const t = await $.clock.now()
        const redraw = () => {
          lastDraw = t
          $.ui.invalidate('ui.render')
        }
        if (!isAnimating) {
          // Events wake it; at rest the band redraws now and then for its clocks.
          if (t - lastDraw >= IDLE_REDRAW_MS) redraw()
          return
        }
        const l = await read($, live)
        const isGlowing = Math.max(l.flash.context, l.flash.limits, l.flash.cost) > t
        // The terminal's spinner and glow step frame by frame. Vectors move on
        // their own and a redraw may reload them all, so off the terminal a
        // turn or a glow redraws only as often as its clock changes.
        const isTerminal = t - lastTerminalDraw < 5_000
        if (isTerminal || t - lastDraw >= VECTOR_TICK_MS - TICK_MS / 2) redraw()
        isAnimating = l.isWorking || isGlowing
      })()
    })
    $.clock.every(LEDGER_REFRESH_MS, () => {
      void (async () => {
        const fresh = await loadLedger($, await $.clock.now())
        await update($, ledger, () => fresh)
      })()
    })

    return result
  })

  // Re-tint the chips when the theme changes mid-session.
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    isLight = await readTheme($)
    $.ui.invalidate('ui.render')
    return result
  })

  on('command.run', { command: 'hud' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'glance' || arg === 'detail') {
      await setView($, { mode: arg })
      return { text: `HUD shows the ${arg} band now.` }
    }
    if (arg === 'hide' || arg === 'show') {
      await setView($, { mode: arg === 'hide' ? 'hidden' : 'glance' })
      return { text: arg === 'hide' ? 'HUD is hidden. /hud or /hud show brings it back.' : 'HUD is back.' }
    }
    if ((TABS as string[]).includes(arg)) {
      await setView($, { mode: 'detail', tab: arg as Tab })
      return { text: `HUD shows ${arg}.` }
    }
    // Plain /hud also brings back a hidden band: the band has nothing left to press.
    if ((await read($, view)).mode === 'hidden') await setView($, { mode: 'glance' })
    const opened = await $.ui.open({ id: PANE, title: 'HUD', focus: true, columns: 96 })
    return { text: opened.isPlaced ? 'HUD dashboard opened.' : 'HUD dashboard opens once the terminal has room.' }
  })

  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    const old = await read($, snapshot)
    await update($, snapshot, () => toSnapshot(e))
    await update($, live, l => ({
      ...l,
      previous: {
        percent: e.changed.includes('context') ? old?.percent : l.previous.percent,
        limits: e.changed.includes('rateLimits') && old ? Object.fromEntries(old.limits.map(x => [x.kind, x.percentUsed])) : l.previous.limits,
      },
      flash: {
        context: e.changed.includes('context') ? now + FLASH_MS : l.flash.context,
        limits: e.changed.includes('rateLimits') ? now + FLASH_MS : l.flash.limits,
        cost: e.changed.includes('cost') ? now + FLASH_MS : l.flash.cost,
      },
    }))
    isAnimating = true
    if (e.cost) await recordCost($, e.cost.usd)
    checkAlerts($, e.rateLimits, now)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    const snap = await read($, snapshot)
    await update($, live, l => ({ ...l, isWorking: true, turnStartedAt: now, toolsThisTurn: 0, usdAtTurnStart: snap?.usd }))
    isAnimating = true

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const group = toolGroup(String(e.tool))
    await update($, live, l => ({
      ...l,
      toolsThisTurn: e.agentId === undefined ? l.toolsThisTurn + 1 : l.toolsThisTurn,
      tools: { ...l.tools, [group]: (l.tools[group] ?? 0) + 1 },
    }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const u = e.usage
    if (u) {
      const all = u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      await update($, live, l => ({
        ...l,
        tokens: {
          input: l.tokens.input + u.input_tokens,
          output: l.tokens.output + u.output_tokens,
          cacheRead: l.tokens.cacheRead + u.cache_read_input_tokens,
          cacheWrite: l.tokens.cacheWrite + u.cache_creation_input_tokens,
          subagent: l.tokens.subagent + (e.agentId === undefined ? 0 : all),
        },
      }))
    }
    if (e.agentId !== undefined) return result // a subagent's turn, not ours

    const usage = await $.session.usage()
    const snap = toSnapshot(usage)
    await update($, snapshot, () => snap)
    const model = await $.session.model()
    const l = await read($, live)
    const history = await read($, turns)
    const turn: Turn = {
      n: (history.at(-1)?.n ?? 0) + 1,
      ms: e.durationMs,
      tools: l.toolsThisTurn,
      percent: snap.percent ?? 0,
      tokens: snap.tokens ?? 0,
      usd: snap.usd !== undefined && l.usdAtTurnStart !== undefined ? Math.max(0, snap.usd - l.usdAtTurnStart) : undefined,
      cacheHit: u ? cacheHit(u) : undefined,
      isAborted: e.isAborted,
    }
    await update($, turns, list => [...list, turn].slice(-HISTORY))
    await update($, live, x => ({ ...x, isWorking: false, model }))

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    const v = await read($, view)
    if (e.props.hasSurvey || snap === null || v.mode === 'hidden' || e.props.maxRows < 1) return next(e)

    const s = { ui: $.ui.resolve(e), isTerminal: e.surface === 'terminal', now: await $.clock.now() }
    if (s.isTerminal) lastTerminalDraw = s.now
    const { Box } = s.ui
    const d = await data($, snap)
    d.live = { ...d.live, isWorking: d.live.isWorking || e.props.isWorking }
    // The terminal draws its own [-] in the band's top-right corner; leave it room.
    const width = e.props.bodyColumns - (s.isTerminal ? 4 : 0)
    const act = actions($)
    const rows = v.mode === 'detail' && e.props.maxRows >= 2 ? drawer(s, d, width, act).slice(0, e.props.maxRows - 1) : []
    return (
      <Box flexDirection="column">
        <Box width={width}>{glance(s, d, width, act)}</Box>
        {rows}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = { ui: $.ui.resolve(e), isTerminal: e.surface === 'terminal', now: await $.clock.now() }
    if (s.isTerminal) lastTerminalDraw = s.now
    const snap = (await read($, snapshot)) ?? { window: 0, limits: [] }
    const d = await data($, snap)
    return dashboard(s, d, e.props.bodyColumns, actions($))
  })
}
