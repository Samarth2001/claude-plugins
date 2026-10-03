import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { dayKey } from './calc'

const SURFACES = ['terminal', 'desktop'] as const
const HOUR = 3_600_000
const NOW = Date.UTC(2026, 9, 15, 12)

const BAND = (isWorking: boolean, bodyColumns = 160, maxRows = 10) =>
  ({
    plugin: 'pulse',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows, bodyColumns, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

const PANE = {
  plugin: 'pulse',
  component: 'Pane',
  requestId: 'pulse',
  props: { title: 'Pulse', isFocused: false, bodyColumns: 120, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

type World = { tokens: number; usd: number; five: number; seven: number }

const usage = (w: World) => ({
  context: { tokens: w.tokens, window: 1_000_000, percent: Math.round(w.tokens / 10_000) },
  rateLimits: [
    // 3h into the 5h window.
    { kind: 'five_hour', percentUsed: w.five, resetsAt: new Date(NOW + 2 * HOUR).toISOString() },
    { kind: 'seven_day', percentUsed: w.seven, resetsAt: new Date(NOW + 4 * 24 * HOUR).toISOString() },
  ],
  cost: { usd: w.usd },
})

// The engine beneath the plugin, its numbers read from `world` on each call.
function engine(on: On, world: World, store = new Map<string, unknown>(), toasts: string[] = []) {
  const clock = mock.clock(on, { now: NOW })
  on('session.start', () => ({ cwd: '/' }))
  on('session.usage', () => ({ value: { startedAt: NOW, ...usage(world) } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.id', () => ({ value: 'session-a' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined } as never
  })
  on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined } as never
  })
  on('store.delete', (_$, e) => {
    store.delete(e.key)
    return { value: undefined } as never
  })
  on('store.keys', () => ({ value: [...store.keys()] }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return clock
}

const world = (): World => ({ tokens: 420_000, usd: 2.07, five: 23, seven: 81 })
const start = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const done = { answer: '', durationMs: 64_000, isAborted: false, turnId: 't', reason: 'answer' } as const
type Found = { text?: string; props?: Record<string, unknown> }
const text = async (ui: { findAll: (q: { type: 'Text' }) => Promise<Found[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('')
const measure = (w: World, changed: ('context' | 'rateLimits' | 'cost')[]) => ({ ...usage(w), changed })

for (const surface of SURFACES) {
  test(`${surface}: one slim row carries context, limits and money`, async ($, on) => {
    engine(on, world())
    await $.session.start(start)
    const ui = await $.ui.mount({ ...BAND(false), surface })
    const line = await text(ui)
    expect(line).toContain('42%')
    expect(line).toContain('23%')
    expect(line).toContain('↻2h00m')
    expect(line).toContain('81%')
    expect(line).toContain('$2.07')
    expect(line).toContain('Oct')
    for (const key of ['open-turns-idle', 'open-context-ctx', 'open-limits-5h', 'open-limits-7d', 'open-cost-cost']) {
      expect(await ui.find({ key })).toBeDefined()
    }
    expect(await ui.find({ key: 'drawer-0' })).toBeUndefined()
    // Gauges are drawn, not typed: cells in the terminal, an animated Svg elsewhere.
    const gauge = (await ui.find({ type: surface === 'terminal' ? 'Raster' : 'Svg' })) as Found | undefined
    expect(gauge).toBeDefined()
    if (surface !== 'terminal') expect(String(gauge?.props?.source)).toContain('color-scheme:light dark')
  })

  test(`${surface}: a label opens its drawer, and again closes it`, async ($, on) => {
    const store = new Map<string, unknown>()
    engine(on, world(), store)
    await $.session.start(start)
    const ui = await $.ui.mount({ ...BAND(false), surface })
    await ui.press({ key: 'open-limits-5h' })
    expect(store.get('view')).toMatchObject({ mode: 'detail', tab: 'limits' }) // remembered
    const limits = await text(ui)
    expect(limits).toContain('↻ 2h00m')
    expect(limits).toContain('↻ 4d 0h')
    expect(limits).toContain('0.4×')
    expect(limits).toContain('38%') // 23% at 3h of 5h carries to 38%
    expect(limits).toContain('at reset')
    expect(limits).toContain('full in')

    await ui.press({ key: 'open-cost-cost' })
    const cost = await text(ui)
    expect(cost).toContain('today')
    expect(cost).toContain('session')
    await ui.press({ key: 'year' })
    expect(store.get('view')).toMatchObject({ tab: 'cost', range: 'year' })

    await ui.press({ key: 'open-context-ctx' })
    expect(await text(ui)).toContain('420k of 1M tokens')

    await ui.press({ key: 'open-context-ctx' })
    expect(await ui.find({ key: 'drawer-0' })).toBeUndefined()
  })
}

test('spend lands in today, and other sessions count toward the month', async ($, on) => {
  const today = dayKey(NOW)
  const store = new Map<string, unknown>([
    [`spent:${today}:session-b`, 3],
    [`spent:${today.slice(0, 8)}01:session-c`, 10],
  ])
  const w = { ...world(), usd: 0 }
  engine(on, w, store)
  await $.session.start(start)
  w.usd = 1
  await $.session.measure(measure(w, ['cost']))
  w.usd = 1.5
  await $.session.measure(measure(w, ['cost']))
  expect(store.get(`spent:${today}:session-a`)).toBe(1.5)
  expect(store.get('seen:session-a')).toMatchObject({ usd: 1.5 })

  await $.command.run({ command: 'pulse', args: 'cost' } as never)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toContain('$1.50')
  if (today.endsWith('-01')) return // both buckets fall on today
  expect(line).toContain('today $4.50')
  expect(line).toContain('Oct $14.50')
})

test('a fresh cost total after /clear counts whole, not as a refund', async ($, on) => {
  const today = dayKey(NOW)
  const store = new Map<string, unknown>([['seen:session-a', { usd: 5, day: today }]])
  const w = { ...world(), usd: 0.5 }
  engine(on, w, store)
  await $.session.start(start)
  await $.session.measure(measure(w, ['cost']))
  expect(store.get(`spent:${today}:session-a`)).toBe(0.5)
})

test('spend older than 400 days is dropped from the store', async ($, on) => {
  const store = new Map<string, unknown>([['spent:2020-01-01:old', 9]])
  engine(on, world(), store)
  await $.session.start(start)
  expect(store.has('spent:2020-01-01:old')).toBe(false)
})

test('a limit crossing 80% toasts once; one already past at start stays quiet', async ($, on) => {
  const toasts: string[] = []
  const w = world() // 7d already at 81%
  engine(on, w, new Map(), toasts)
  await $.session.start(start)
  await $.session.measure(measure(w, ['rateLimits']))
  expect(toasts).toEqual([])
  w.five = 82
  await $.session.measure(measure(w, ['rateLimits']))
  await $.session.measure(measure(w, ['rateLimits']))
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('5h limit at 82%')
  expect(toasts[0]).toContain('resets in 2h00m')
})

test('a fresh reading glows, then settles', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  w.tokens = 500_000
  await $.session.measure(measure(w, ['context']))
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const glowing = async () => (await ui.findAll({ type: 'Text' })).find(t => t.text === '50%')?.props?.inverse
  expect(await glowing()).toBe(true)
  await clock.advance(2000)
  expect(await glowing()).toBe(false)
})

test('the heartbeat moves while a turn runs and counts tools', async ($, on) => {
  const clock = engine(on, world())
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't' })
  await $.tool.call({ tool: 'Read', file_path: '/a.ts' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await text(ui)).toContain('1 tool')
  const trace = async () => ((await ui.find({ key: 'wave' })) as Found | undefined)?.props?.cells
  const before = await trace()
  await clock.advance(420)
  expect(await trace()).not.toBe(before)
})

test('the turns tab lists finished turns and the tool mix', async ($, on) => {
  const w = world()
  engine(on, w)
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.session.start(start)
  for (const tokens of [420_000, 470_000]) {
    w.tokens = tokens
    await $.turn.start({ text: 'go', turnId: 't' })
    await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
    await $.tool.call({ tool: 'mcp__github__get_me' } as never)
    await $.turn.complete({ ...done, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 90, cache_creation_input_tokens: 0, model: 'm' } })
  }
  await $.command.run({ command: 'pulse', args: 'turns' } as never)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toContain('2 turns')
  expect(line).toContain('last 1m04s')
  expect(line).toContain('Bash 2')
  expect(line).toContain('MCP 2')
  expect(await ui.find({ key: 'timeline' })).toBeDefined()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = await text(pane)
  expect(all).toContain('#2')
  expect(all).toContain('+50k ctx')
  expect(all).toContain('cache 90%')
})

test('/pulse hide and show, and /pulse opens the dashboard', async ($, on) => {
  engine(on, world())
  await $.session.start(start)
  const run = async (args: string) => ((await $.command.run({ command: 'pulse', args } as never)) as { text?: string }).text
  expect(await run('hide')).toContain('hidden')
  const hidden = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  expect(await hidden.find({ key: 'open-context-ctx' })).toBeUndefined()
  await hidden.unmount()
  await run('show')
  const shown = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  expect(await shown.find({ key: 'open-context-ctx' })).toBeDefined()

  expect(await run('')).toContain('dashboard opened')
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = await text(pane)
  expect(all).toContain('Plan limits')
  expect(all).toContain('Spend')
  expect(all).toContain('Turns')
})

test('a narrow band keeps only the numbers', async ($, on) => {
  engine(on, world())
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false, 70), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toContain('42%')
  expect(line).toContain('$2.07')
  expect(line).not.toContain('Oct')
  expect(await ui.find({ key: 'bar-five_hour' })).toBeUndefined() // numbers only
})
