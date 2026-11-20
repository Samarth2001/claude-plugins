import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ThemeSetArgs } from 'claude-code'

// Local times, so the hour reads the same in any time zone.
const NOON = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000

type World = {
  store: Map<string, unknown>
  themes: ThemeSetArgs[]
  clears: number
  /** Whether a client that draws themes is attached. */
  isDrawn: boolean
  /** How the engine answers the next tool calls. */
  tools: 'ok' | 'error' | 'deny'
}

const world = (entries: Record<string, unknown> = {}): World => ({
  store: new Map(Object.entries(entries)),
  themes: [],
  clears: 0,
  isDrawn: true,
  tools: 'ok',
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World, now = NOON) {
  const clock = mock.clock(on, { now })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'mesh-glow' } }))
  on('theme.set', (_$, e) => {
    w.themes.push(e)
    return { value: w.isDrawn ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, reason: 'no window draws themes' } } as never
  })
  on('theme.clear', () => {
    w.clears += 1
    return { value: { isDrawn: false, reason: 'cleared' } } as never
  })
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('store.get', (_$, e) => ({ value: w.store.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    w.store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined } as never
  })
  on('store.delete', (_$, e) => {
    w.store.delete(e.key)
    return { value: undefined } as never
  })
  on('store.keys', () => ({ value: [...w.store.keys()] }) as never)
  on('tool.call', () => (w.tools === 'deny' ? { deny: 'no' } : w.tools === 'error' ? { isError: true, result: 'failed', text: 'failed' } : { result: {} }) as never)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('classic.SessionStart', () => ({}))
  return clock
}

const start = { cwd: '/home/me/desk', surface: 'desktop', isInteractive: true } as const
const begin = { text: 'do the thing', turnId: 't' } as const
const done = { answer: '', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as const
const read = { tool: 'Read', file_path: '/home/me/desk/a.ts' } as const
const run = async ($: Engine, args: string) => (await $.command.run({ command: 'mesh-glow', args } as never)).text

const BACKDROP = (plugin = 'mesh-glow', scene = 'mesh-glow') =>
  ({
    plugin: 'mesh-glow',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 4, tint: '#111419', opacity: 0.28 }, overrideColorScheme: 'dark' },
  }) as const

/** The values the backdrop hands its shader on a surface. */
async function values($: Engine, surface: 'desktop' | 'mobile' = 'desktop'): Promise<Record<string, unknown>> {
  const ui = await $.ui.mount({ ...BACKDROP(), surface })
  const shader = await ui.find({ type: 'Shader' })
  await ui.unmount()
  return shader?.props.values as Record<string, unknown>
}

test('the start sets the theme: its scene, dark colours under its label, and the soft glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Mesh Glow')
  expect(set?.overrideColorScheme).toBe('dark')
  expect(set?.backdrop).toEqual({ scene: 'mesh-glow', glass: { blur: 4, tint: '#111419', opacity: 0.28 } })
})

test('a stored off sets no theme at the start', async ($, on) => {
  const off = world({ enabled: false })
  engine(on, off)
  await $.session.start(start)
  expect(off.themes).toHaveLength(0)
})

test('a stored frosted glass is used at the start', async ($, on) => {
  const w = world({ glass: 'frosted' })
  engine(on, w)
  await $.session.start(start)
  expect(w.themes[0]?.backdrop).toMatchObject({ glass: { blur: 16, tint: '#111419', opacity: 0.5 } })
})

test('/mesh-glow says whether it is drawn here, and the glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, '')).toBe('Mesh Glow is on, drawn behind this window.\nThe glass is soft.')
  await run($, 'off')
  expect(await run($, '')).toBe('Mesh Glow is off. /mesh-glow on brings it back.\nThe glass is soft.')
})

test('/mesh-glow says when this window draws no backdrops', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(await run($, '')).toBe(
    "Mesh Glow is on, but this window doesn't draw backdrops: it shows in the Claude desktop app.\nThe glass is soft.",
  )
})

test('/mesh-glow on, off, glass and help answer as documented', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)

  expect(await run($, 'off')).toBe('Mesh Glow is off. /mesh-glow on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)

  expect(await run($, ' ON ')).toBe('Mesh Glow is on.')
  expect(w.store.has('enabled')).toBe(false)
  expect(w.themes).toHaveLength(2)

  expect(await run($, 'glass clear')).toBe('The glass is clear.')
  expect(w.store.get('glass')).toBe('clear')
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: false })
  expect(await run($, 'glass  Frosted')).toBe('The glass is frosted.')
  expect(w.store.get('glass')).toBe('frosted')
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: { blur: 16, opacity: 0.5 } })
  expect(await run($, 'glass soft')).toBe('The glass is soft.')
  expect(w.store.has('glass')).toBe(false)
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: { blur: 4, opacity: 0.28 } })
  expect(w.themes).toHaveLength(5)

  expect(await run($, 'glass foggy')).toBe('The glass is soft. Try /mesh-glow glass clear, soft or frosted.')
  expect(await run($, 'glass')).toBe('The glass is soft. Try /mesh-glow glass clear, soft or frosted.')
  expect(w.themes).toHaveLength(5)

  expect(await run($, 'brighter')).toBe('Try /mesh-glow, or on, off, glass clear|soft|frosted, or forget.')
})

test('/mesh-glow glass while off keeps the choice and sets no theme', async ($, on) => {
  const w = world({ enabled: false })
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'glass frosted')).toBe('The glass is frosted.')
  expect(w.store.get('glass')).toBe('frosted')
  expect(w.themes).toHaveLength(0)
})

test('/mesh-glow forget deletes everything it kept, and clears only a theme of its own', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'glass frosted')
  expect(await run($, 'forget')).toBe('Mesh Glow forgot what it kept and is off until it loads again.')
  expect([...w.store.keys()]).toEqual([])
  expect(w.clears).toBe(1)
  // Off already: a forget leaves whatever theme stands alone.
  await run($, 'forget')
  expect(w.clears).toBe(1)
})

test('the backdrop is the shader holding the still picture, on desktop and mobile', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP(), surface })
    const tree = await ui.drawn()
    // The engine hands on `./shader.ts` resolved from the plugin's root.
    expect(tree).toMatchObject({ type: 'Shader', props: { module: 'hooks/shader.ts' } })
    const svgs = await ui.findAll({ type: 'Svg' })
    expect(svgs).toHaveLength(1)
    expect(String(svgs[0]?.props.source)).toStartWith('<svg')
    expect(String(svgs[0]?.props.alt)).toContain('slate, teal and plum')
    await ui.unmount()
    expect(await values($, surface)).toEqual({ work: 0, calls: 0, errs: 0, turns: 0, sends: 0, hour: 12 })
  }
})

test("Claude's turn and its calls reach the shader as values", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)

  await $.turn.start(begin)
  expect(await values($)).toMatchObject({ work: 1, sends: 1, calls: 0 })

  w.tools = 'error'
  await $.tool.call(read)
  expect(await values($)).toMatchObject({ calls: 1, errs: 1 })

  // A denied call never ran: it counts for nothing.
  w.tools = 'deny'
  await $.tool.call(read)
  expect(await values($)).toMatchObject({ calls: 1, errs: 1 })

  await $.turn.complete(done)
  expect(await values($)).toMatchObject({ work: 0, turns: 1 })

  // A stopped turn rests the field without its brightening.
  await $.turn.start(begin)
  await $.turn.complete({ ...done, isAborted: true })
  expect(await values($)).toMatchObject({ work: 0, turns: 1, sends: 2 })
})

test("a subagent's turns and calls change nothing", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start({ ...begin, agentId: 'a1' })
  w.tools = 'error'
  await $.tool.call({ ...read, agentId: 'a1' } as never)
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(await values($)).toEqual({ work: 0, calls: 0, errs: 0, turns: 0, sends: 0, hour: 12 })
})

test("another plugin's backdrop, or another scene, passes through untouched", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const theirs = await $.ui.mount({ ...BACKDROP('someone-else'), surface })
    expect(await theirs.find({ type: 'Shader' })).toBeUndefined()
    expect(await theirs.find({ type: 'Svg' })).toBeUndefined()
    await theirs.unmount()

    const other = await $.ui.mount({ ...BACKDROP('mesh-glow', 'lagoon'), surface })
    expect(await other.find({ type: 'Shader' })).toBeUndefined()
    expect(await other.find({ type: 'Svg' })).toBeUndefined()
    await other.unmount()
  }
})

test('the hour moves on with the clock between turns', async ($, on) => {
  const w = world()
  const clock = engine(on, w, new Date(2026, 10, 20, 18, 55).getTime())
  await $.session.start(start)
  expect((await values($)).hour).toBe(18.9)
  await clock.advance(10 * MINUTE)
  expect((await values($)).hour).toBe(19.1)
  // The theme is set once: the hour reaches the shader as a value, never a new theme.
  expect(w.themes).toHaveLength(1)
})

test('a clear, resume or fork sets the theme again', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.classic.SessionStart({ source: 'clear' })
  await $.classic.SessionStart({ source: 'startup' })
  expect(w.themes).toHaveLength(2)
})

test('it stores nothing but its own settings', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.tool.call(read)
  await $.turn.complete(done)
  expect([...w.store.keys()]).toEqual([])
})
