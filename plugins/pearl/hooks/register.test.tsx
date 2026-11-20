import { expect, mock, test } from 'claude-code/testing'
import type { Engine, FoundElement } from 'claude-code/testing'
import type { On, ThemeSetArgs } from 'claude-code'

// Local times, so the hour reads the same in any time zone.
const NOON = new Date(2026, 10, 17, 12).getTime()
const MINUTE = 60_000

type World = {
  store: Map<string, unknown>
  themes: ThemeSetArgs[]
  clears: number
  logs: string[]
  /** Whether a client that draws themes is attached. */
  isDrawn: boolean
  /** How the engine answers the next tool calls. */
  tools: 'ok' | 'error' | 'deny'
}

const world = (entries: Record<string, unknown> = {}): World => ({
  store: new Map(Object.entries(entries)),
  themes: [],
  clears: 0,
  logs: [],
  isDrawn: true,
  tools: 'ok',
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World, now = NOON) {
  const clock = mock.clock(on, { now })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'pearl' } }))
  on('theme.set', (_$, e) => {
    w.themes.push(e)
    return { value: w.isDrawn ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, reason: 'no window draws themes' } } as never
  })
  on('theme.clear', () => {
    w.clears += 1
    return { value: { isDrawn: false, reason: 'cleared' } } as never
  })
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', (_$, e) => {
    w.logs.push(e.text)
    return { value: undefined } as never
  })
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
const run = async ($: Engine, args: string) => (await $.command.run({ command: 'pearl', args } as never)).text

const BACKDROP = (scene = 'pearl', plugin = 'pearl') =>
  ({
    plugin: 'pearl',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 4, tint: '#111116', opacity: 0.28 }, overrideColorScheme: 'dark' },
  }) as const

/** The backdrop's tree on a surface: its root and the Svgs inside. */
async function backdrop($: Engine, surface: 'desktop' | 'mobile' = 'desktop', scene?: string, plugin?: string) {
  const ui = await $.ui.mount({ ...BACKDROP(scene, plugin), surface })
  const shader = await ui.find({ type: 'Shader' })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return { shader, svgs }
}

const valuesOf = (shader: FoundElement | undefined) => shader?.props.values as Record<string, number> | undefined

test('session.start sets the theme: the scene, dark colours and the soft glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Pearl')
  expect(set?.overrideColorScheme).toBe('dark')
  expect(set?.backdrop).toMatchObject({ scene: 'pearl', glass: { blur: 4, tint: '#111116', opacity: 0.28 } })
})

test('a stored off sets nothing at the start', async ($, on) => {
  const off = world({ enabled: false })
  engine(on, off)
  await $.session.start(start)
  expect(off.themes).toHaveLength(0)
})

test('a stored frosted glass is used at the start', async ($, on) => {
  const w = world({ glass: 'frosted' })
  engine(on, w)
  await $.session.start(start)
  expect(w.themes[0]?.backdrop).toMatchObject({ glass: { blur: 16, tint: '#111116', opacity: 0.5 } })
})

test('/pearl says whether it is drawn, and the glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, '')).toBe('Pearl is on, drawn behind this window.\nThe glass is soft.')
})

test('/pearl says when this window draws no backdrop', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start(start)
  expect(await run($, '')).toBe("Pearl is on, but this window doesn't draw backdrops: it shows in the Claude desktop app.\nThe glass is soft.")
})

test('/pearl off clears the theme and keeps it off; on brings it back', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'off')).toBe('Pearl is off. /pearl on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)
  expect(await run($, '')).toBe('Pearl is off. /pearl on brings it back.\nThe glass is soft.')
  expect(await run($, ' ON ')).toBe('Pearl is on.')
  expect(w.store.has('enabled')).toBe(false)
  expect(w.themes).toHaveLength(2)
})

test('/pearl glass sets each glass and keeps all but soft', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'glass clear')).toBe('The glass is clear.')
  expect(w.themes[1]?.backdrop).toMatchObject({ glass: false })
  expect(w.store.get('glass')).toBe('clear')
  expect(await run($, 'glass   frosted')).toBe('The glass is frosted.')
  expect(w.themes[2]?.backdrop).toMatchObject({ glass: { blur: 16, opacity: 0.5 } })
  expect(w.store.get('glass')).toBe('frosted')
  expect(await run($, 'glass soft')).toBe('The glass is soft.')
  expect(w.themes[3]?.backdrop).toMatchObject({ glass: { blur: 4, opacity: 0.28 } })
  expect(w.store.has('glass')).toBe(false)
})

test('/pearl glass with a bad word or none says the glass and the words', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'glass tinted')).toBe('The glass is soft. Try /pearl glass clear, soft or frosted.')
  expect(await run($, 'glass')).toBe('The glass is soft. Try /pearl glass clear, soft or frosted.')
  expect(w.themes).toHaveLength(1)
})

test('/pearl forget empties the store and clears the theme', async ($, on) => {
  const w = world({ glass: 'frosted' })
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'forget')).toBe('Pearl forgot what it kept and is off until it loads again.')
  expect(w.store.size).toBe(0)
  expect(w.clears).toBe(1)
  expect(await run($, '')).toBe('Pearl is off. /pearl on brings it back.\nThe glass is soft.')
})

test('/pearl with anything else gives the help line', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'sparkle')).toBe('Try /pearl, or on, off, glass clear|soft|frosted, or forget.')
})

test('the backdrop is the shader over the still picture, on desktop and mobile', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const { shader, svgs } = await backdrop($, surface)
    // The element's `./shader.ts`, as the engine resolves it from the plugin's root.
    expect(shader?.props.module).toBe('hooks/shader.ts')
    expect(svgs).toHaveLength(1)
    expect(String(svgs[0]?.props.source)).toStartWith('<svg')
    expect(String(svgs[0]?.props.alt)).toContain('near-black')
    expect(valuesOf(shader)).toEqual({ work: 0, calls: 0, errs: 0, turns: 0, sends: 0, hour: 12 })
  }
})

test("the shader's values follow the main loop's turn", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  expect(valuesOf((await backdrop($)).shader)).toMatchObject({ work: 1, sends: 1 })
  w.tools = 'error'
  await $.tool.call(read)
  expect(valuesOf((await backdrop($)).shader)).toMatchObject({ calls: 1, errs: 1 })
  w.tools = 'deny'
  await $.tool.call(read)
  expect(valuesOf((await backdrop($)).shader)).toMatchObject({ calls: 1, errs: 1 })
  await $.turn.complete(done)
  expect(valuesOf((await backdrop($)).shader)).toMatchObject({ work: 0, turns: 1 })
})

test("a subagent's turns and calls change nothing", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start({ ...begin, agentId: 'a1' })
  w.tools = 'error'
  await $.tool.call({ ...read, agentId: 'a1' } as never)
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(valuesOf((await backdrop($)).shader)).toEqual({ work: 0, calls: 0, errs: 0, turns: 0, sends: 0, hour: 12 })
})

test("another plugin's backdrop, or another scene, passes through", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const theirs = await backdrop($, surface, 'pearl', 'someone-else')
    expect(theirs.shader).toBeUndefined()
    expect(theirs.svgs).toHaveLength(0)
    const other = await backdrop($, surface, 'lagoon')
    expect(other.shader).toBeUndefined()
    expect(other.svgs).toHaveLength(0)
  }
})

test('the hour moves on with the clock between turns', async ($, on) => {
  const w = world()
  const clock = engine(on, w, new Date(2026, 10, 17, 18, 55).getTime())
  await $.session.start(start)
  expect(valuesOf((await backdrop($)).shader)?.hour).toBe(18.9)
  await clock.advance(10 * MINUTE)
  expect(valuesOf((await backdrop($)).shader)?.hour).toBe(19.1)
})
