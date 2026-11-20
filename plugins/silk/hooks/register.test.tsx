import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ThemeSetArgs } from 'claude-code'

// Local times, so the hour reads the same in any time zone.
const NOON = new Date(2026, 10, 17, 12).getTime()
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
  on('command.register', () => ({ value: { command: 'silk' } }))
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
const read = (file_path: string) => ({ tool: 'Read', file_path }) as const
const run = async ($: Engine, args: string) => (await $.command.run({ command: 'silk', args } as never)).text

const BACKDROP = (scene = 'silk', plugin = 'silk') =>
  ({
    plugin: 'silk',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 4, tint: '#111216', opacity: 0.28 }, overrideColorScheme: 'dark' },
  }) as const

/** The values the backdrop hands its shader, as drawn on the desktop. */
async function values($: Engine): Promise<Record<string, unknown>> {
  const ui = await $.ui.mount({ ...BACKDROP(), surface: 'desktop' })
  const shader = await ui.find({ type: 'Shader' })
  await ui.unmount()
  return shader?.props.values as Record<string, unknown>
}

test('session.start sets the theme: the colors, the scene and the soft glass, dark', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Silk')
  expect(set?.overrideColorScheme).toBe('dark')
  expect(set?.backdrop).toEqual({ scene: 'silk', glass: { blur: 4, tint: '#111216', opacity: 0.28 } })
  expect(await run($, '')).toBe('Silk is on, drawn behind this window.\nThe glass is soft.')
})

test('a later session that was turned off sets nothing, and a kept glass is used', async ($, on) => {
  const w = world({ enabled: false, glass: 'frosted' })
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(0)
  expect(await run($, '')).toBe('Silk is off. /silk on brings it back.\nThe glass is frosted.')
  expect(await run($, 'on')).toBe('Silk is on.')
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: { blur: 16, opacity: 0.5 } })
})

test('the summary says when this window draws no backdrops', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(await run($, '')).toBe("Silk is on, but this window doesn't draw backdrops: it shows in the Claude desktop app.\nThe glass is soft.")
})

test('/silk and its words answer as documented', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)

  expect(await run($, 'off')).toBe('Silk is off. /silk on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)

  expect(await run($, ' ON ')).toBe('Silk is on.')
  expect(w.store.has('enabled')).toBe(false)
  expect(w.themes).toHaveLength(2)

  expect(await run($, 'glass clear')).toBe('The glass is clear.')
  expect(w.store.get('glass')).toBe('clear')
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ scene: 'silk', glass: false })
  expect(await run($, 'glass  Frosted')).toBe('The glass is frosted.')
  expect(w.store.get('glass')).toBe('frosted')
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: { blur: 16, tint: '#111216', opacity: 0.5 } })
  expect(await run($, 'glass foggy')).toBe('The glass is frosted. Try /silk glass clear, soft or frosted.')
  expect(await run($, 'glass')).toBe('The glass is frosted. Try /silk glass clear, soft or frosted.')
  expect(await run($, 'glass soft')).toBe('The glass is soft.')
  expect(w.store.has('glass')).toBe(false)
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: { blur: 4, tint: '#111216', opacity: 0.28 } })
  expect(w.themes).toHaveLength(5)

  expect(await run($, 'shimmer')).toBe('Try /silk, or on, off, glass clear|soft|frosted, or forget.')
})

test('the glass changes while off are kept and set nothing', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'off')
  expect(await run($, 'glass clear')).toBe('The glass is clear.')
  expect(w.themes).toHaveLength(1)
  expect(w.store.get('glass')).toBe('clear')
})

test('/silk forget deletes everything it kept, and clears only a theme of its own', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'glass frosted')
  expect(await run($, 'forget')).toBe('Silk forgot what it kept and is off until it loads again.')
  expect([...w.store.keys()]).toEqual([])
  expect(w.clears).toBe(1)
  expect(await run($, '')).toBe('Silk is off. /silk on brings it back.\nThe glass is soft.')
  // Off already: a forget leaves whatever theme stands alone.
  await run($, 'forget')
  expect(w.clears).toBe(1)
})

test('a clear, resume or fork sets the theme again', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.classic.SessionStart({ source: 'clear' })
  await $.classic.SessionStart({ source: 'startup' })
  expect(w.themes).toHaveLength(2)
})

test('the backdrop is a shader over one still Svg, on desktop and mobile', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP(), surface })
    // The kit names the module by its path in the plugin: the element's `./shader.ts`.
    const tree = await ui.drawn()
    expect(tree).toMatchObject({ type: 'Shader', props: { module: 'hooks/shader.ts' } })
    expect((tree as { children?: unknown[] }).children).toHaveLength(1)
    const svgs = await ui.findAll({ type: 'Svg' })
    expect(svgs).toHaveLength(1)
    expect(String(svgs[0]?.props.source)).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"')
    expect(String(svgs[0]?.props.alt)).toContain('satin')
    await ui.unmount()
  }
})

test("another plugin's backdrop, or another scene, passes through untouched", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const theirs = await $.ui.mount({ ...BACKDROP('silk', 'someone-else'), surface })
    expect(await theirs.find({ type: 'Shader' })).toBeUndefined()
    expect(await theirs.find({ type: 'Svg' })).toBeUndefined()
    await theirs.unmount()

    const unknown = await $.ui.mount({ ...BACKDROP('lagoon'), surface })
    expect(await unknown.find({ type: 'Shader' })).toBeUndefined()
    expect(await unknown.find({ type: 'Svg' })).toBeUndefined()
    await unknown.unmount()
  }
})

test("the shader's values follow the main loop's turns and tool calls", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await values($)).toEqual({ work: 0, calls: 0, errs: 0, turns: 0, sends: 0, hour: 12 })

  await $.turn.start(begin)
  expect(await values($)).toMatchObject({ work: 1, sends: 1 })

  w.tools = 'error'
  await $.tool.call(read('/home/me/desk/missing.ts'))
  expect(await values($)).toMatchObject({ calls: 1, errs: 1 })

  // A denied call never ran: no wave, no error.
  w.tools = 'deny'
  await $.tool.call(read('/home/me/desk/secret.ts'))
  w.tools = 'ok'
  await $.tool.call(read('/home/me/desk/a.ts'))
  expect(await values($)).toMatchObject({ calls: 2, errs: 1 })

  await $.turn.complete(done)
  expect(await values($)).toEqual({ work: 0, calls: 2, errs: 1, turns: 1, sends: 1, hour: 12 })

  // A stopped turn is no finished one.
  await $.turn.start(begin)
  await $.turn.complete({ ...done, isAborted: true })
  expect(await values($)).toMatchObject({ work: 0, turns: 1, sends: 2 })
})

test("a subagent's turns and calls change nothing", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.tools = 'error'
  await $.turn.start({ ...begin, agentId: 'a1' })
  await $.tool.call({ ...read('/home/me/desk/a.ts'), agentId: 'a1' } as never)
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(await values($)).toEqual({ work: 0, calls: 0, errs: 0, turns: 0, sends: 0, hour: 12 })
  expect(w.themes).toHaveLength(1)
})

test('the hour moves on by itself between turns', async ($, on) => {
  const w = world()
  const clock = engine(on, w, new Date(2026, 10, 17, 18, 55).getTime())
  await $.session.start(start)
  expect((await values($)).hour).toBe(18.9)
  await clock.advance(10 * MINUTE)
  expect((await values($)).hour).toBe(19.1)
  // The theme itself is not set again: only the shader's hour moved.
  expect(w.themes).toHaveLength(1)
})
