import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = (isWorking: boolean, bodyColumns = 160) =>
  ({
    plugin: 'buddy',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  }) as const

const usage = (tokens: number) => ({
  context: { tokens, window: 1_000_000, percent: Math.round(tokens / 10_000) },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 23, resetsAt: '2099-01-01T00:00:00Z' },
    { kind: 'seven_day', percentUsed: 81 },
  ],
  cost: { usd: 2.414 },
})

function engine(on: On, tokens = 380_000) {
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/' }))
  on('session.usage', () => ({ value: { startedAt: 0, ...usage(tokens) } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('prompt.submit', (_$, e) => e as never)
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return clock
}

const start = { cwd: '/', surface: 'terminal', isInteractive: true } as const
const text = async (ui: { findAll: (q: { type: 'Text' }) => Promise<{ text?: string }[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('')

test('idle band shows the companion and every stat', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toContain('(•◡•)')
  expect(line).toContain('ready')
  expect(line).toContain('38%')
  expect(line).toContain('380.0k/1M')
  expect(line).toContain('5h 23%')
  expect(line).toContain('7d 81%')
  expect(line).toContain('$2.41')
  expect(line).toContain('opus-5-5')
})

test('desktop draws an animated SVG companion', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'desktop' })
  const art = await ui.find({ type: 'Svg' })
  expect(art).toBeDefined()
  expect(await text(ui)).toContain('ready')
})

test('acts out the running tool, counts it, then celebrates', async ($, on) => {
  let during = ''
  on('tool.call', async () => {
    const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
    during = await text(ui)
    await ui.unmount()
    return { result: 'ok' } as never
  })
  engine(on)
  await $.session.start(start)
  await $.prompt.submit({ text: 'go' } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/app.ts', old_string: 'a', new_string: 'b' } as never)
  expect(during).toContain('editing app.ts')
  expect(during).toContain('✎')

  const working = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await text(working)).toContain('1 tools')
  await working.unmount()

  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  const after = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  const line = await text(after)
  expect(line).toContain('done')
  expect(line).toContain('1 files edited')
})

test('a failed tool makes it flinch', async ($, on) => {
  on('tool.call', () => ({ result: 'boom', isError: true }) as never)
  engine(on)
  await $.session.start(start)
  await $.prompt.submit({ text: 'go' } as never)
  await $.tool.call({ tool: 'Bash', command: 'false' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  expect(await text(ui)).toContain('(°□°)')
})

test('the face animates while working', async ($, on) => {
  const clock = engine(on)
  await $.session.start(start)
  await $.prompt.submit({ text: 'go' } as never)
  const ui = await $.ui.mount({ ...BAND(true), surface: 'terminal' })
  const before = await text(ui)
  await clock.advance(150)
  expect(await text(ui)).not.toBe(before)
})

test('near-full context asks for /compact', async ($, on) => {
  engine(on, 920_000)
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false), surface: 'terminal' })
  expect(await text(ui)).toContain('/compact')
})

test('narrow band keeps the essentials', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BAND(false, 80), surface: 'terminal' })
  const line = await text(ui)
  expect(line).toContain('38%')
  expect(line).not.toContain('380.0k/1M')
})
