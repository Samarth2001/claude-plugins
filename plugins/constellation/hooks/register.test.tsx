import { expect, mock, test } from 'claude-code/testing'
import type { On, ThemeSetArgs } from 'claude-code'

import { parseSky } from './sky'

const ROOT = '/home/me/atlas'
const KEY = `sky:${ROOT}`
const NOW = Date.UTC(2026, 10, 17, 12)

type World = {
  store: Map<string, unknown>
  themes: ThemeSetArgs[]
  clears: number
  toasts: string[]
  logs: string[]
  /** Whether a client that draws themes is attached. */
  isDrawn: boolean
  /** A store that fails every read or write. */
  isStoreBroken: boolean
  /** How the engine answers the next tool calls. */
  tools: 'ok' | 'error' | 'deny'
}

const world = (entries: Record<string, unknown> = {}): World => ({
  store: new Map(Object.entries(entries)),
  themes: [],
  clears: 0,
  toasts: [],
  logs: [],
  isDrawn: true,
  isStoreBroken: false,
  tools: 'ok',
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World) {
  const clock = mock.clock(on, { now: NOW })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: ROOT }) as never)
  on('command.register', () => ({ value: { command: 'constellation' } }))
  on('theme.set', (_$, e) => {
    w.themes.push(e)
    return { value: w.isDrawn ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, reason: 'no window draws themes' } } as never
  })
  on('theme.clear', () => {
    w.clears += 1
    return { value: { isDrawn: false, reason: 'cleared' } } as never
  })
  on('ui.toast', (_$, e) => {
    w.toasts.push(e.text)
    return { value: undefined } as never
  })
  on('ui.log', (_$, e) => {
    w.logs.push(e.text)
    return { value: undefined } as never
  })
  const broken = () => {
    if (w.isStoreBroken) throw new Error('the disk is full')
  }
  on('store.get', (_$, e) => {
    broken()
    return { value: w.store.get(e.key) } as never
  })
  on('store.set', (_$, e) => {
    broken()
    w.store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined } as never
  })
  on('store.delete', (_$, e) => {
    broken()
    w.store.delete(e.key)
    return { value: undefined } as never
  })
  on('store.keys', () => ({ value: [...w.store.keys()] }) as never)
  on('tool.call', () =>
    (w.tools === 'deny' ? { deny: 'no' } : w.tools === 'error' ? { isError: true, result: 'failed', text: 'failed' } : { result: {} }) as never,
  )
  on('turn.complete', () => ({ text: '' }))
  on('classic.SessionStart', () => ({}))
  return clock
}

const start = { cwd: ROOT, surface: 'desktop', isInteractive: true } as const
const done = { answer: '', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as const
const edit = (file_path: string) => ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }) as const
const write = (file_path: string) => ({ tool: 'Write', file_path, content: 'x' }) as const
const read = (file_path: string) => ({ tool: 'Read', file_path }) as const
const bash = (command: string) => ({ tool: 'Bash', command }) as const
const stored = (w: World) => parseSky(w.store.get(KEY))
const sceneOf = (args: ThemeSetArgs | undefined) =>
  args?.backdrop !== undefined && 'scene' in args.backdrop ? args.backdrop.scene : undefined

const BACKDROP = (scene: string, plugin = 'constellation') =>
  ({
    plugin: 'constellation',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 18, tint: '#0a0f20', opacity: 0.46 }, overrideColorScheme: 'dark' },
  }) as const

test('session.start sets the theme once: colors, a sky scene and glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Constellation')
  expect(set?.overrideColorScheme).toBe('dark')
  expect(set?.backdrop).toMatchObject({ scene: 'sky-a', glass: { blur: 18, tint: '#0a0f20', opacity: 0.46 } })
  // The first time, with an empty sky, a hint says what the sky is for, and only once.
  expect(w.toasts).toHaveLength(1)
  expect(w.store.get('hinted')).toBe(true)
})

test('no hint where nothing draws the theme, or the sky has stars', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start(start)
  expect(w.toasts).toHaveLength(0)
})

test('an Edit and a Write in one turn make two stars and a constellation, under the other scene', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.tool.call(edit(`${ROOT}/src/a.ts`))
  await $.tool.call(write(`${ROOT}/README.md`))
  await $.turn.complete(done)
  const sky = stored(w)
  expect(Object.keys(sky.stars).sort()).toEqual(['README.md', 'src/a.ts'])
  expect(sky.stars['src/a.ts']).toMatchObject({ edits: 1, reads: 0, born: NOW + 1, touched: NOW })
  expect(sky.constellations).toEqual([{ at: NOW, files: ['README.md', 'src/a.ts'] }])
  expect(w.themes.map(sceneOf)).toEqual(['sky-a', 'sky-b'])
})

test('a Read alone makes a dust star and no constellation', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.tool.call(read(`${ROOT}/docs/guide.md`))
  await $.turn.complete(done)
  const sky = stored(w)
  expect(sky.stars['docs/guide.md']).toMatchObject({ edits: 0, reads: 1 })
  expect(sky.constellations).toHaveLength(0)
})

test('a failed or denied call records nothing, nor does a file outside the project', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.tools = 'error'
  await $.tool.call(edit(`${ROOT}/a.ts`))
  w.tools = 'deny'
  await $.tool.call(edit(`${ROOT}/b.ts`))
  w.tools = 'ok'
  await $.tool.call(edit('/home/me/other/c.ts'))
  await $.tool.call(edit(`${ROOT}/node_modules/x/d.js`))
  await $.turn.complete(done)
  expect(w.store.has(KEY)).toBe(false)
  expect(w.themes).toHaveLength(1) // nothing changed, so nothing is drawn again
})

test("a subagent's turn end does not flush; the main loop's does, with the subagent's edits", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.tool.call({ ...edit(`${ROOT}/lib/one.ts`), agentId: 'a1' })
  await $.tool.call({ ...edit(`${ROOT}/lib/two.ts`), agentId: 'a1' })
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(w.store.has(KEY)).toBe(false)
  await $.tool.call(edit(`${ROOT}/lib/three.ts`))
  await $.turn.complete(done)
  expect(Object.keys(stored(w).stars).sort()).toEqual(['lib/one.ts', 'lib/three.ts', 'lib/two.ts'])
})

test('a passing test run brings a meteor at the turn end; a failing one does not', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  w.tools = 'error'
  await $.tool.call(bash('npm test'))
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(1)

  w.tools = 'ok'
  await $.tool.call(bash('cd app && npm test'))
  await $.turn.complete(done)
  expect(w.themes.map(sceneOf)).toEqual(['sky-a', 'sky-b'])
  const ui = await $.ui.mount({ ...BACKDROP('sky-b'), surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('class="cn-met"')
  await ui.unmount()

  // Once the reveal is over, the sky is drawn at rest, with no meteor.
  await clock.advance(13_000)
  const later = await $.ui.mount({ ...BACKDROP('sky-b'), surface: 'desktop' })
  expect(String((await later.find({ type: 'Svg' }))?.props.source)).not.toContain('class="cn-met"')
})

test("another session's stars in the store survive this session's write", async ($, on) => {
  const other = { version: 1, stars: { 'theirs.ts': { edits: 4, reads: 0, born: 1, touched: 1 } }, constellations: [] }
  const w = world()
  engine(on, w)
  await $.session.start(start)
  // The other session wrote after this one started.
  w.store.set(KEY, other)
  await $.tool.call(edit(`${ROOT}/mine.ts`))
  await $.turn.complete(done)
  expect(Object.keys(stored(w).stars).sort()).toEqual(['mine.ts', 'theirs.ts'])
})

test('the backdrop draws on desktop and mobile, and passes on what is not its own', async ($, on) => {
  const w = world({ [KEY]: { version: 1, stars: { 'a.ts': { edits: 3, reads: 0, born: 1, touched: 1 } }, constellations: [] } })
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP('sky-a'), surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props.source)).toStartWith('<svg')
    expect(svg?.props.isInteractive).toBe(true)
    expect(String(svg?.props.alt)).toContain('1 star in 0 constellations')
    await ui.unmount()

    const theirs = await $.ui.mount({ ...BACKDROP('sky-a', 'someone-else'), surface })
    expect(await theirs.find({ type: 'Svg' })).toBeUndefined()
    await theirs.unmount()

    const unknown = await $.ui.mount({ ...BACKDROP('lagoon'), surface })
    expect(await unknown.find({ type: 'Svg' })).toBeUndefined()
    await unknown.unmount()
  }
})

test('a second ask for the same sky gets the same document', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  const one = await $.ui.mount({ ...BACKDROP('sky-a'), surface: 'desktop' })
  const two = await $.ui.mount({ ...BACKDROP('sky-a'), surface: 'mobile' })
  expect((await one.find({ type: 'Svg' }))?.props.source).toBe((await two.find({ type: 'Svg' }))?.props.source)
})

test('/constellation and its words answer as documented', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  const run = async (args: string) => (await $.command.run({ command: 'constellation', args } as never)).text

  expect(await run('')).toBe(
    'Constellation: atlas\nNo stars yet. Files Claude edits become stars; files edited in the same turn join into a constellation.',
  )

  expect(await run('off')).toBe('Constellation is off. Your sky is kept; /constellation on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)
  await $.tool.call(edit(`${ROOT}/a.ts`))
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(1) // off: the turn records, and sets no theme
  expect(stored(w).stars['a.ts']).toBeDefined()

  expect(await run(' ON ')).toBe('Constellation is on.')
  expect(w.store.has('enabled')).toBe(false)
  expect(w.themes).toHaveLength(2)

  expect(await run('reset')).toBe("This project's sky is cleared.")
  expect(w.store.has(KEY)).toBe(false)
  expect(w.themes).toHaveLength(3)

  expect(await run('stars please')).toBe('Try /constellation, /constellation off, /constellation on or /constellation reset.')
})

test('the summary says when this window draws no backdrops', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  const text = (await $.command.run({ command: 'constellation', args: '' } as never)).text
  expect(text).toContain("This window doesn't draw backdrops; the sky still records and shows in the desktop app.")
})

test('a later session that was turned off sets no theme', async ($, on) => {
  const w = world({ enabled: false })
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(0)
})

test('a clear, resume or fork sets the theme again', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.classic.SessionStart({ source: 'clear' })
  await $.classic.SessionStart({ source: 'startup' })
  expect(w.themes).toHaveLength(2)
})

test('a store that fails costs nothing: the engine still gets its answers', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.isStoreBroken = true
  const out = await $.tool.call(edit(`${ROOT}/a.ts`))
  expect(out.deny).toBeUndefined()
  expect(out.isError).toBeUndefined()
  const end = await $.turn.complete(done)
  expect(end.text).toBe('')
  // The sky still updates here, and the fault went to the debug log.
  expect(w.themes.map(sceneOf)).toEqual(['sky-a', 'sky-b'])
  expect(w.logs.some(line => line.startsWith('reading the sky failed'))).toBe(true)
  expect(w.logs.some(line => line.startsWith('keeping the sky failed'))).toBe(true)
})

test('a store that fails at the start costs the session nothing', async ($, on) => {
  const w = world()
  w.isStoreBroken = true
  engine(on, w)
  expect(await $.session.start(start)).toEqual({ cwd: ROOT })
})
