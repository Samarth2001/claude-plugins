import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionUsage } from 'claude-code'

import type { Ledger, Limit, Live, Snapshot, Tab, Turn, View } from '../types'
import { LIMIT_LABELS, addDays, cacheHit, dayKey, formatSpan, toolGroup } from './calc'
import { body, dashboard, glance, tabBar } from './draw'
import type { Actions, Data } from './draw'

const IDLE: Live = {
  isWorking: false,
  turnStartedAt: 0,
  toolsThisTurn: 0,
  model: '',
  tools: {},
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, subagent: 0 },
  flash: { context: 0, limits: 0, cost: 0 },
}
const DEFAULT_VIEW: View = { mode: 'glance', tab: 'limits', range: 'week' }

const snapshot = atom({ plugin: 'pulse', key: 'snapshot' } as const, null)
const turns = atom({ plugin: 'pulse', key: 'turns' } as const, [])
const live = atom({ plugin: 'pulse', key: 'live' } as const, IDLE)
const ledger = atom({ plugin: 'pulse', key: 'ledger' } as const, { days: {} })
const view = atom({ plugin: 'pulse', key: 'view' } as const, DEFAULT_VIEW)

const PANE = 'pulse'
const HISTORY = 40
const TICK_MS = 140
const IDLE_REDRAW_MS = 20_000
const FLASH_MS = 1400
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

// Sums every session's spend per day from the store, dropping old days.
async function loadLedger($: $, now: number): Promise<Ledger> {
  const oldest = addDays(dayKey(now), -KEEP_DAYS)
  const days: Record<string, number> = {}
  for (const key of await $.store.keys()) {
    if (!key.startsWith('spent:')) continue
    const day = key.slice(6, 16)
    if (day < oldest) {
      await $.store.delete(key)
      continue
    }
    const usd = Number(await $.store.get(key))
    if (Number.isFinite(usd)) days[day] = (days[day] ?? 0) + usd
  }
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
      $.ui.toast(`pulse: ${LIMIT_LABELS[limit.kind] ?? limit.kind} limit at ${Math.round(limit.percentUsed)}%${resets}`, { timeoutMs: 6000 })
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
    openPane: () => void $.ui.open({ id: PANE, title: 'Pulse', columns: 96 }),
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
  }
}

export const register: Register = on => {
  // Redraw pacing only; everything drawn comes from $.state.
  let isAnimating = false
  let lastIdleDraw = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'pulse',
      description: 'Usage cockpit: "/pulse" opens the dashboard; glance, detail, hide or show sets the band',
    })
    const now = await $.clock.now()
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
        if (isAnimating || t - lastIdleDraw >= IDLE_REDRAW_MS) {
          lastIdleDraw = t
          $.ui.invalidate('ui.render')
        }
        if (!isAnimating) return // events wake it; idle ticks cost nothing more
        const l = await read($, live)
        isAnimating = l.isWorking || Math.max(l.flash.context, l.flash.limits, l.flash.cost) > t
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

  on('command.run', { command: 'pulse' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'glance' || arg === 'detail') {
      await setView($, { mode: arg })
      return { text: `pulse shows the ${arg} band now.` }
    }
    if (arg === 'hide' || arg === 'show') {
      await setView($, { mode: arg === 'hide' ? 'hidden' : 'glance' })
      return { text: arg === 'hide' ? 'pulse is hidden. /pulse show brings it back.' : 'pulse is back.' }
    }
    if ((TABS as string[]).includes(arg)) {
      await setView($, { mode: 'detail', tab: arg as Tab })
      return { text: `pulse shows ${arg}.` }
    }
    const opened = await $.ui.open({ id: PANE, title: 'Pulse', focus: true, columns: 96 })
    return { text: opened.isPlaced ? 'Pulse dashboard opened.' : 'Pulse dashboard opens once the terminal has room.' }
  })

  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, snapshot, () => toSnapshot(e))
    await update($, live, l => ({
      ...l,
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

    const ui = $.ui.resolve(e)
    const { Box } = ui
    const d = await data($, snap)
    d.live = { ...d.live, isWorking: d.live.isWorking || e.props.isWorking }
    const width = e.props.bodyColumns
    const act = actions($)
    const isTerminal = e.surface === 'terminal'

    if (v.mode === 'glance' || e.props.maxRows < 3) {
      return <Box flexDirection="column" marginRight={isTerminal ? 4 : 0}>{glance(ui, d, width, act)}</Box>
    }
    return (
      <Box flexDirection="column">
        <Box marginRight={isTerminal ? 4 : 0}>{glance(ui, d, width, act)}</Box>
        {tabBar(ui, d, width, act, isTerminal)}
        {body(ui, d, v.tab, width, Math.min(5, e.props.maxRows - 2), act)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const snap = (await read($, snapshot)) ?? { window: 0, limits: [] }
    const d = await data($, snap)
    return dashboard(ui, d, e.props.bodyColumns, actions($))
  })
}
