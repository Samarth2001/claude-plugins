import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const

const BAND = (isWorking: boolean, bodyColumns = 160, maxRows = 10) =>
  ({
    plugin: 'buddy',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows, bodyColumns, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

const usage = (tokens: number) => ({
  context: { tokens, window: 1_000_000, percent: Math.round(tokens / 10_000) },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 23, resetsAt: '2099-01-01T00:00:00Z' },
    { kind: 'seven_day', percentUsed: 81 },
  ],
  cost: { usd: 2.414 },
})

// The engine beneath the plugin. `tokens` is read on every usage call, so a
// test can grow the context between turns.
function engine(on: On, context = { tokens: 380_000 }, store = new Map<string, unknown>()) {
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/' }))
  on('session.usage', () => ({ value: { startedAt: 0, ...usage(context.tokens) } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('command.register', () => ({ value: undefined }) as never)
  on('store.get', (_$, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return clock
}

const start = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const done = { answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as const
type Found = { text?: string; props?: Record<string, unknown> }
const text = async (ui: { findAll: (q: { type: 'Text' }) => Promise<Found[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('')

for (const surface of SURFACES) {
  test(`${surface}: idle band draws buddy and the session numbers`, async ($, on) => {
    engine(on)
    await $.session.start(start)
    const ui = await $.ui.mount({ ...BAND(false), surface })
    const line = await text(ui)
    expect(line).toContain('ready')
    expect(line).toContain('38%')
    expect(line).toContain('380k/1M')
    expect(line).toContain('5h')
    expect(line).toContain('23%')
    expect(line).toContain('81%')
    expect(line).toContain('$2.41')
    expect(line).toContain('opus-5-5')
    if (surface === 'terminal') {
      const art = (await ui.find({ type: 'Raster' })) as Found | undefined
      expect(art?.props?.columns).toBe(19)
      expect(art?.props?.rows).toBe(4)
    } else {
      const art = (await ui.find({ type: 'Svg' })) as Found | undefined
      const source = String(art?.props?.source)
      expect(source).toContain('color-scheme:light dark') // no white box on a dark app
      expect(source).toContain('calcMode="discrete"') // animates without redraws
    }
  })

  test(`${surface}: acts out the running tool, then celebrates`, async ($, on) => {
    let during = ''
    on('tool.call', async () => {
      const ui = await $.ui.mount({ ...BAND(true), surface })
      during = await text(ui)
      await ui.unmount()
      return { result: 'ok' } as never
    })
    engine(on)
    await $.session.start(start)
    await $.turn.start({ text: 'go', turnId: 't' })
    await $.tool.call({ tool: 'Edit', file_path: '/repo/src/app.ts', old_string: 'a', new_string: 'b' } as never)
    expect(during).toContain('editing')
    expect(during).toContain('app.ts')
    expect(during).toContain('1 tools')

    await $.turn.complete(done)
    const after = await $.ui.mount({ ...BAND(false), surface })
    const line = await text(after)
    expect(line).toContain('done')
    expect(line).toContain('1 tool')
    expect(line).toContain('1 file edited')
  })

  test(`${surface}: a failed tool says oops`, async ($, on) => {
    on('tool.call', () => ({ result: 'boom', isError: true }) as never)
    engine(on)
    await $.session.start(start)
    await $.turn.start({ text: 'go', turnId: 't' })
    await $.tool.call({ tool: 'Bash', command: 'false' } as never)
    const ui = await $.ui.mount({ ...BAND(true), surface })
    expect(await text(ui)).toContain('oops')
  })

  test(`${surface}: compact button shrinks it to the face and remembers`, async ($, on) => {
    const store = new Map<string, unknown>()
    engine(on, undefined, store)
    await $.session.start(start)
    const ui = await $.ui.mount({ ...BAND(false), surface })
    await ui.press({ key: 'size' })
    const line = await text(ui)
    expect(line).toContain('38%')
    expect(line).not.toContain('opus-5-5')
    expect(store.get('isCompact')).toBe(true) // remembered for the next session
    if (surface === 'terminal') {
      const art = (await ui.find({ type: 'Raster' })) as Found | undefined
      expect(art?.props?.rows).toBe(2)
    }
  })
}

test('the terminal sprite animates while working', async ($, on) => {
  const clock = engine(on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't' })
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  const cellsAt = async () => ((await ui.find({ type: 'Raster' })) as Found | undefined)?.props?.cells
  const before = await cellsAt()
  await clock.advance(400)
  expect(await cellsAt()).not.toBe(before)
})

test('the sparkline grows a bar per turn and shows the jump', async ($, on) => {
  const context = { tokens: 100_000 }
  engine(on, context)
  await $.session.start(start)
  for (const tokens of [100_000, 300_000, 600_000]) {
    context.tokens = tokens
    await $.turn.start({ text: 'go', turnId: 't' })
    await $.turn.complete(done)
  }
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toMatch(/ctx [▁-█]{4} 60%/)
  expect(line).toContain('▲300k')
})

test('near-full context wilts the sprout and asks for /compact', async ($, on) => {
  engine(on, { tokens: 920_000 })
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toContain('stuffed')
  expect(line).toContain('/compact')
})

test('a subagent finishing does not end our turn', async ($, on) => {
  engine(on)
  await $.session.start(start)
  await $.turn.start({ text: 'go', turnId: 't' })
  await $.turn.complete({ ...done, agentId: 'sub' } as never)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  expect(await text(ui)).not.toContain('done')
})

test('/buddy hides and brings it back', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const run = (args: string) => $.command.run({ command: 'buddy', args } as never)
  expect((await run('')) as { text?: string }).toMatchObject({ text: expect.stringContaining('hidden') })
  const hidden = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  expect(await text(hidden)).not.toContain('ready')
  await hidden.unmount()
  await run('')
  const shown = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  expect(await text(shown)).toContain('ready')
})

test('a narrow terminal falls back to the compact face', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false, 60), surface: 'terminal' })
  const art = (await ui.find({ type: 'Raster' })) as Found | undefined
  expect(art?.props?.rows).toBe(2)
  expect(await text(ui)).toContain('ready')
})
