import { expect, mock, test } from 'claude-code/testing'
import type { On, PaneOpenArgs, ThemeSetArgs } from 'claude-code'

import { LOOKS } from './look'

/** A local clock reading on the test day, whatever this machine's time zone. */
const at = (hour: number, minute = 0) => new Date(2026, 10, 17, hour, minute).getTime()

type World = {
  store: Map<string, unknown>
  themes: ThemeSetArgs[]
  clears: number
  opens: PaneOpenArgs[]
  closes: string[]
  logs: string[]
  isDrawn: boolean
  isStoreBroken: boolean
  /** How the engine answers the next tool calls. */
  tools: 'ok' | 'error' | 'deny'
}

const world = (entries: Record<string, unknown> = {}): World => ({
  store: new Map(Object.entries(entries)),
  themes: [],
  clears: 0,
  opens: [],
  closes: [],
  logs: [],
  isDrawn: true,
  isStoreBroken: false,
  tools: 'ok',
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World, now = at(12)) {
  const clock = mock.clock(on, { now })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  on('command.register', () => ({ value: { command: 'real-sky' } }))
  on('theme.set', (_$, e) => {
    w.themes.push(e)
    return { value: w.isDrawn ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, reason: 'no window draws themes' } } as never
  })
  on('theme.clear', () => {
    w.clears += 1
    return { value: { isDrawn: false, reason: 'cleared' } } as never
  })
  on('ui.open', (_$, e) => {
    w.opens.push(e)
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', (_$, e) => {
    w.closes.push(e.id)
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
  // The engine's own drawing of a component the plugin hands on: its props, as text.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{JSON.stringify(e.props)}</Text>
  })
  return clock
}

const start = { cwd: '/home/me/app', surface: 'desktop', isInteractive: true } as const
const done = { answer: '', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as const
const read = (file_path: string) => ({ tool: 'Read', file_path }) as const
const bash = (command: string) => ({ tool: 'Bash', command }) as const
const sceneOf = (args: ThemeSetArgs | undefined) =>
  args?.backdrop !== undefined && 'scene' in args.backdrop ? args.backdrop.scene : undefined
const labels = (w: World) => w.themes.map(args => args.colors?.label)

const BACKDROP = (scene: string, plugin = 'real-sky') =>
  ({
    plugin: 'real-sky',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 22, tint: '#e7eaec', opacity: 0.58 }, overrideColorScheme: 'light' },
  }) as const

const PANE = (placement: 'dock' | 'inline' | 'widget') =>
  ({
    plugin: 'real-sky',
    component: 'Pane',
    requestId: 'almanac',
    props: { title: 'Almanac', isFocused: false, bodyColumns: 40, placement, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }) as const

const SPINNER = (word: string, message: string | null = null) =>
  ({ plugin: 'real-sky', component: 'Spinner', requestId: 'main', props: { word, message, suffix: '…', mode: 'thinking' } }) as const

const MODES = { plugin: 'real-sky', component: 'SessionMode', props: { modes: ['focus'] } } as const

/** What the engine was handed to draw, read back from its echo. */
async function handed(ui: { find: (query: { type: string }) => Promise<{ text: string } | undefined> }) {
  return JSON.parse((await ui.find({ type: 'Text' }))?.text ?? '{}') as Record<string, unknown>
}

test('session.start at noon sets the day theme once: light colors, a sky scene and glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Real Sky day')
  expect(set?.overrideColorScheme).toBe('light')
  expect(set?.backdrop).toMatchObject({ scene: 'sky-a', glass: LOOKS.day.glass })
})

test('late evening is night, with dark colors', async ($, on) => {
  const w = world()
  engine(on, w, at(22, 30))
  await $.session.start(start)
  expect(labels(w)).toEqual(['Real Sky night'])
  expect(w.themes[0]?.overrideColorScheme).toBe('dark')
})

test('an error clouds the sky at once, and a clean turn clears it at the turn end', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.tools = 'error'
  await $.tool.call(read('/home/me/app/missing.ts'))
  expect(w.themes.map(sceneOf)).toEqual(['sky-a', 'sky-b'])
  const ui = await $.ui.mount({ ...BACKDROP('sky-b'), surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('a cloudy day sky')
  await ui.unmount()
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(2) // still cloudy: that turn had its error

  w.tools = 'ok'
  await $.tool.call(read('/home/me/app/a.ts'))
  await $.turn.complete(done)
  expect(w.themes.map(sceneOf)).toEqual(['sky-a', 'sky-b', 'sky-a'])
  const clear = await $.ui.mount({ ...BACKDROP('sky-a'), surface: 'desktop' })
  expect(String((await clear.find({ type: 'Svg' }))?.props.alt)).toContain('a clear day sky')
})

test('errors piling up in one turn bring a storm mid-turn, setting the theme only when it worsens', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.tools = 'error'
  for (let i = 0; i < 4; i++) await $.tool.call(read(`/home/me/app/${i}.ts`))
  expect(w.themes).toHaveLength(3) // clear, cloudy, storm
  const ui = await $.ui.mount({ ...BACKDROP('sky-a'), surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('class="rs-rain"')
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(3)
})

test('a failed test run storms; a passing one clears the sky when the turn ends', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.tools = 'error'
  await $.tool.call(bash('cd app && npm test'))
  expect(w.themes).toHaveLength(2)
  w.tools = 'ok'
  await $.tool.call(bash('npm test'))
  expect(w.themes).toHaveLength(2) // it clears only at the turn end
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(3)
  const ui = await $.ui.mount({ ...BACKDROP(sceneOf(w.themes[2]) ?? ''), surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).not.toContain('class="rs-rain"')
})

test("a denied call is no error, and a subagent's turn end settles nothing", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  w.tools = 'deny'
  await $.tool.call(read('/home/me/app/a.ts'))
  expect(w.themes).toHaveLength(1)
  w.tools = 'error'
  await $.tool.call({ ...read('/home/me/app/b.ts'), agentId: 'a1' })
  expect(w.themes).toHaveLength(2)
  w.tools = 'ok'
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(w.themes).toHaveLength(2)
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(2) // the main turn holds the subagent's error
})

test('the clock moves the sky: a new part of the day sets its theme, a quiet tick sets none', async ($, on) => {
  const w = world()
  const clock = engine(on, w, at(16, 50))
  await $.session.start(start)
  await clock.advance(5 * 60_000)
  expect(w.themes).toHaveLength(1) // 16:55: still day, and the sun in the same place
  await clock.advance(5 * 60_000)
  expect(labels(w)).toEqual(['Real Sky day', 'Real Sky dusk'])
  expect(w.themes[1]?.overrideColorScheme).toBe('dark')
})

test('the sun takes a new place as the day goes on', async ($, on) => {
  const w = world()
  const clock = engine(on, w, at(12))
  await $.session.start(start)
  await clock.advance(5 * 60_000)
  expect(w.themes).toHaveLength(1)
  await clock.advance(25 * 60_000)
  expect(labels(w)).toEqual(['Real Sky day', 'Real Sky day'])
})

test('a second session.start still follows the clock', async ($, on) => {
  const w = world()
  const clock = engine(on, w, at(16, 58))
  await $.session.start(start)
  await $.session.start(start)
  expect(w.themes).toHaveLength(2)
  await clock.advance(5 * 60_000)
  expect(w.themes).toHaveLength(3)
})

test('the backdrop draws on desktop and mobile, and passes on what is not its own', async ($, on) => {
  const w = world()
  engine(on, w, at(12, 4))
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP('sky-a'), surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props.source)).toStartWith('<svg')
    expect(String(svg?.props.source)).toContain('>DAY · 12:04<')
    expect(svg?.props.isInteractive).toBe(true)
    expect(String(svg?.props.alt)).toBe('a clear day sky at 12:04, the sun on a hairline arc above a low, misty horizon')
    await ui.unmount()

    const theirs = await $.ui.mount({ ...BACKDROP('sky-a', 'someone-else'), surface })
    expect(await theirs.find({ type: 'Svg' })).toBeUndefined()
    await theirs.unmount()

    const unknown = await $.ui.mount({ ...BACKDROP('lagoon'), surface })
    expect(await unknown.find({ type: 'Svg' })).toBeUndefined()
    await unknown.unmount()
  }
})

test('the night sky carries the moon of the date', async ($, on) => {
  const w = world()
  engine(on, w, at(23, 30))
  await $.session.start(start)
  const ui = await $.ui.mount({ ...BACKDROP('sky-a'), surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(String(svg?.props.alt)).toContain('a first quarter on a hairline arc')
  expect(String(svg?.props.source)).toContain('FIRST QUARTER')
})

test('/real-sky answers in the almanac voice, and its words do as documented', async ($, on) => {
  const w = world()
  engine(on, w, at(9, 5))
  await $.session.start(start)
  const run = async (args: string) => (await $.command.run({ command: 'real-sky', args } as never)).text

  // The moon's lit share moves a little with the machine's time zone.
  expect(await run('')).toMatch(
    /^Day, 09:05\. Clear sky; dusk at 17:00\.\nMoon: first quarter, \d+% lit\.\nBarometer: settled\. Nothing logged yet\.$/,
  )

  expect(await run('off')).toBe('The sky is off. /real-sky on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)
  expect(w.closes).toEqual(['almanac'])
  w.tools = 'error'
  await $.tool.call(read('/home/me/app/a.ts'))
  expect(w.themes).toHaveLength(1) // off: weather is noted, and no theme set
  expect(await run('')).toContain('Barometer: pressure falling, 1 error this turn.\nThe sky is off; /real-sky on brings it back.')

  expect(await run(' ON ')).toBe('The sky is back.')
  expect(w.store.has('enabled')).toBe(false)
  expect(w.themes).toHaveLength(2)

  expect(await run('dusk')).toBe('The sky is pinned to dusk; /real-sky auto follows the clock again.')
  expect(w.store.get('phase')).toBe('dusk')
  expect(labels(w).at(-1)).toBe('Real Sky dusk')
  expect(await run('')).toContain('Pinned to dusk')

  expect(await run('auto')).toBe('The sky follows your clock.')
  expect(w.store.has('phase')).toBe(false)
  expect(labels(w).at(-1)).toBe('Real Sky day')

  expect(await run('rainbow')).toStartWith('Try /real-sky')
  expect(await run('dusk now')).toStartWith('Try /real-sky')

  expect(await run('forget')).toBe('Real Sky forgot what it kept and is off until it loads again.')
  expect([...w.store.keys()]).toEqual([])
  expect(w.clears).toBe(2)
  await run('forget')
  expect(w.clears).toBe(2) // off already: whatever theme stands is left alone
})

test('the summary says when this window draws no backdrops', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  const text = (await $.command.run({ command: 'real-sky', args: '' } as never)).text
  expect(text).toContain("This window doesn't draw backdrops; the sky shows in the desktop and mobile apps.")
})

test('a later session keeps the pin, and one turned off sets no theme', async ($, on) => {
  const w = world({ phase: 'night' })
  engine(on, w)
  await $.session.start(start)
  expect(labels(w)).toEqual(['Real Sky night'])
  w.store.set('enabled', false)
  w.themes.length = 0
  await $.session.start(start)
  expect(w.themes).toHaveLength(0)
})

test('a clear, resume or fork sets the theme again', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.classic.SessionStart({ source: 'clear' })
  await $.classic.SessionStart({ source: 'startup' })
  expect(w.themes.map(sceneOf)).toEqual(['sky-a', 'sky-b'])
})

test('a store that fails at the start costs the session nothing', async ($, on) => {
  const w = world()
  w.isStoreBroken = true
  engine(on, w)
  expect(await $.session.start(start)).toEqual({ cwd: '/home/me/app' })
  expect(w.logs.some(line => line.startsWith('session.start failed'))).toBe(true)
})

// The almanac ------------------------------------------------------------------

test('the almanac opens as a widget on desktop, once a session, and never unasked elsewhere', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(w.opens).toEqual([])
  await $.session.attach({ surface: 'mobile', clientId: 'phone' })
  expect(w.opens).toEqual([])
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  expect(w.opens).toEqual([{ id: 'almanac', title: 'Almanac', placement: 'widget' }])
  await $.session.start(start) // a reload runs session.start again
  expect(w.opens).toHaveLength(1)
})

test('/real-sky almanac opens it, and off or on keeps the choice for later sessions', async ($, on) => {
  const w = world()
  engine(on, w)
  const run = async (args: string) => (await $.command.run({ command: 'real-sky', args } as never)).text
  expect(await run('almanac')).toBe('The almanac is open.')
  expect(w.opens.at(-1)).toEqual({ id: 'almanac', title: 'Almanac' })
  expect(await run('almanac off')).toStartWith('The almanac is closed')
  expect(w.store.get('almanac')).toBe(false)
  expect(w.closes).toEqual(['almanac'])
  const opened = w.opens.length
  await $.session.start(start)
  expect(w.opens).toHaveLength(opened) // the person said no: it stays closed
  expect(await run('almanac on')).toBe('The almanac opens at each start in the desktop app again.')
  expect(w.store.has('almanac')).toBe(false)
  expect(await run('almanac sideways')).toStartWith('Try /real-sky')
})

test('the almanac draws a card docked, a glance as a widget, and text on the terminal', async ($, on) => {
  const w = world()
  engine(on, w, at(18, 12))
  await $.session.start(start)
  w.tools = 'error'
  await $.tool.call(read('/home/me/app/a.ts'))

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const card = await $.ui.mount({ ...PANE('dock'), surface })
    const svg = await card.find({ type: 'Svg' })
    expect(String(svg?.props.source)).toContain('>BAROMETER<')
    expect(String(svg?.props.source)).toContain('>Pressure falling, 1 error this turn.<')
    expect(String(svg?.props.alt)).toStartWith('Almanac: dusk, 18:12, cloudy.')
    await card.unmount()
  }

  const glance = await $.ui.mount({ ...PANE('widget'), surface: 'desktop' })
  const small = String((await glance.find({ type: 'Svg' }))?.props.source)
  expect(small).toContain('>FALLING<')
  expect(small).not.toContain('>BAROMETER<')
  await glance.unmount()

  const text = await $.ui.mount({ ...PANE('dock'), surface: 'terminal' })
  expect((await text.find({ type: 'Text', text: /^Dusk/ }))?.text).toBe('Dusk · 18:12 · cloudy')
  expect(await text.find({ type: 'Text', text: /Pressure falling/ })).toBeDefined()
  await text.unmount()
})

test('the barometer rises with clean turns and the card says so', async ($, on) => {
  const w = world()
  engine(on, w, at(12))
  await $.session.start(start)
  for (let i = 0; i < 3; i++) {
    await $.tool.call(read(`/home/me/app/${i}.ts`))
    await $.turn.complete(done)
  }
  const ui = await $.ui.mount({ ...PANE('dock'), surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Fair. 3 turns clear.' })).toBeDefined()
})

test('the spinner reads the sky, leaves a message or a desktop step alone, and goes quiet when off', async ($, on) => {
  const w = world()
  engine(on, w, at(18, 12))
  await $.session.start(start)
  const DUSK = ['Watching the light go', 'Logging the sunset', 'Marking the dusk']

  for (const surface of ['terminal', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...SPINNER('Sauteing'), surface })
    expect(DUSK).toContain((await handed(ui)).word)
    await ui.unmount()
  }
  const working = await $.ui.mount({ ...SPINNER('Working'), surface: 'desktop' })
  expect(DUSK).toContain((await handed(working)).word)
  await working.unmount()
  const step = await $.ui.mount({ ...SPINNER('Creating notes.md'), surface: 'desktop' })
  expect((await handed(step)).word).toBe('Creating notes.md')
  await step.unmount()
  const message = await $.ui.mount({ ...SPINNER('Sauteing', 'Compacting conversation'), surface: 'terminal' })
  expect(await handed(message)).toMatchObject({ word: 'Sauteing', message: 'Compacting conversation' })
  await message.unmount()

  w.tools = 'error'
  for (let i = 0; i < 3; i++) await $.tool.call(read(`/home/me/app/${i}.ts`))
  const storm = await $.ui.mount({ ...SPINNER('Sauteing'), surface: 'terminal' })
  expect(['Riding out the storm', 'Waiting out the rain', 'Holding the course']).toContain((await handed(storm)).word)
  await storm.unmount()

  await $.command.run({ command: 'real-sky', args: 'off' } as never)
  const off = await $.ui.mount({ ...SPINNER('Sauteing'), surface: 'terminal' })
  expect((await handed(off)).word).toBe('Sauteing')
})

test('the footer gains one quiet label, and loses it when off', async ($, on) => {
  const w = world()
  engine(on, w, at(18, 12))
  await $.session.start(start)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MODES, surface })
    expect((await handed(ui)).modes).toEqual(['focus', 'dusk · clear'])
    await ui.unmount()
  }
  await $.command.run({ command: 'real-sky', args: 'off' } as never)
  const off = await $.ui.mount({ ...MODES, surface: 'terminal' })
  expect((await handed(off)).modes).toEqual(['focus'])
})
