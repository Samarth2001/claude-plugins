import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, PaneOpenArgs, ThemeSetArgs } from 'claude-code'

// Local times, so the time of day reads the same in any time zone.
const NOON = new Date(2026, 10, 17, 12).getTime()
const EVENING = new Date(2026, 10, 17, 21).getTime()
const MINUTE = 60_000

type World = {
  store: Map<string, unknown>
  themes: ThemeSetArgs[]
  clears: number
  sounds: { asset: string; gain: number | undefined }[]
  logs: string[]
  opens: PaneOpenArgs[]
  closes: string[]
  /** Whether a client that draws themes is attached. */
  isDrawn: boolean
  /** Whether a clip can play. */
  canPlay: boolean
  /** How the engine answers the next tool calls. */
  tools: 'ok' | 'error' | 'deny'
}

const world = (entries: Record<string, unknown> = {}): World => ({
  store: new Map(Object.entries(entries)),
  themes: [],
  clears: 0,
  sounds: [],
  logs: [],
  opens: [],
  closes: [],
  isDrawn: true,
  canPlay: true,
  tools: 'ok',
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World, now = NOON) {
  const clock = mock.clock(on, { now })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  on('command.register', () => ({ value: { command: 'pixel-room' } }))
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
  on('ui.invalidate', () => ({ value: undefined }) as never)
  on('ui.log', (_$, e) => {
    w.logs.push(e.text)
    return { value: undefined } as never
  })
  on('audio.play', (_$, e) => {
    if (!w.canPlay) throw new Error('no player')
    const clip = e.clip as { asset: string }
    w.sounds.push({ asset: clip.asset, gain: e.gain })
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
  on('tool.call', () =>
    (w.tools === 'deny' ? { deny: 'no' } : w.tools === 'error' ? { isError: true, result: 'failed', text: 'failed' } : { result: {} }) as never,
  )
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('classic.SessionStart', () => ({}))
  return clock
}

const start = { cwd: '/home/me/desk', surface: 'desktop', isInteractive: true } as const
const begin = { text: 'do the thing', turnId: 't' } as const
const done = { answer: '', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as const
const bash = (command: string) => ({ tool: 'Bash', command }) as const
const read = (file_path: string) => ({ tool: 'Read', file_path }) as const
const sceneOf = (args: ThemeSetArgs | undefined) =>
  args?.backdrop !== undefined && 'scene' in args.backdrop ? args.backdrop.scene : undefined
const run = async ($: Engine, args: string) => (await $.command.run({ command: 'pixel-room', args } as never)).text

const BACKDROP = (scene: string, plugin = 'pixel-room') =>
  ({
    plugin: 'pixel-room',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 16, tint: '#16121f', opacity: 0.5 }, overrideColorScheme: 'dark' },
  }) as const

const PANE = (placement: 'dock' | 'inline' | 'widget') =>
  ({
    plugin: 'pixel-room',
    component: 'Pane',
    requestId: 'pixel-room',
    props: { title: 'Pixel Room', isFocused: false, bodyColumns: 40, placement, scroll: { offset: 0, bodyRows: 20 }, view: {} },
  }) as const

async function drawn($: Engine, scene: string): Promise<string> {
  const ui = await $.ui.mount({ ...BACKDROP(scene), surface: 'desktop' })
  const source = String((await ui.find({ type: 'Svg' }))?.props.source)
  await ui.unmount()
  return source
}

test('session.start sets the theme once: day colors, a room scene and glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Pixel Room')
  expect(set?.overrideColorScheme).toBe('dark')
  expect(set?.backdrop).toMatchObject({ scene: 'room-a', glass: { blur: 16, tint: '#16121f', opacity: 0.5 } })
})

test('in the evening the lamp is lit and the colors are warmer', async ($, on) => {
  const w = world()
  engine(on, w, EVENING)
  await $.session.start(start)
  expect(w.themes[0]?.colors?.label).toBe('Pixel Room Lamplight')
  expect(await drawn($, 'room-a')).toContain('class="pr-gl"')
})

test('a turn moves the cat at most at its start, first call, first error and end', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await drawn($, 'room-a')).toContain('class="pr-b0"')

  await $.turn.start(begin)
  expect(w.themes.map(sceneOf)).toEqual(['room-a', 'room-b'])
  expect(await drawn($, 'room-b')).toContain('class="pr-pc"')

  // The first tool call sits it down to watch; later calls change nothing.
  await $.tool.call(read('/home/me/desk/a.ts'))
  await $.tool.call(read('/home/me/desk/b.ts'))
  expect(w.themes).toHaveLength(3)
  expect(await drawn($, 'room-a')).toContain('class="pr-t pr-t0"')

  // The first error startles it, once.
  w.tools = 'error'
  await $.tool.call(read('/home/me/desk/missing.ts'))
  await $.tool.call(read('/home/me/desk/missing2.ts'))
  expect(w.themes).toHaveLength(4)
  expect(await drawn($, 'room-b')).toContain('class="pr-jo"')

  // A turn whose last call failed ends with the cat simply curling up.
  await $.turn.complete(done)
  expect(w.themes).toHaveLength(5)
  const last = await drawn($, 'room-a')
  expect(last).toContain('class="pr-b0"')
  expect(last).not.toContain('class="pr-st"')
})

test('a clean turn ends with a stretch before the cat curls up', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.turn.complete(done)
  expect(w.themes.map(sceneOf)).toEqual(['room-a', 'room-b', 'room-a'])
  const scene = await drawn($, 'room-a')
  expect(scene).toContain('class="pr-st"')
  expect(scene).toContain('class="pr-b0"')
})

test("a subagent's turns and calls leave the cat alone", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start({ ...begin, agentId: 'a1' })
  await $.tool.call({ ...read('/home/me/desk/a.ts'), agentId: 'a1' } as never)
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(w.themes).toHaveLength(1)
  expect(w.sounds).toHaveLength(0)
})

test('a clean turn plays the finish sound, softly', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.tool.call(read('/home/me/desk/a.ts'))
  await $.turn.complete(done)
  await clock.settle()
  expect(w.sounds).toEqual([{ asset: 'sounds/finish.wav', gain: 0.5 }])
})

test('a turn whose last call errored, or whose tests failed, plays the failure sound', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)

  await $.turn.start(begin)
  w.tools = 'error'
  await $.tool.call(read('/home/me/desk/missing.ts'))
  await $.turn.complete(done)

  await $.turn.start(begin)
  await $.tool.call(bash('npm test'))
  w.tools = 'ok'
  await $.tool.call(read('/home/me/desk/a.ts'))
  await $.turn.complete(done)

  // Tests that fail, then pass, end clean.
  await $.turn.start(begin)
  w.tools = 'error'
  await $.tool.call(bash('npm test'))
  w.tools = 'ok'
  await $.tool.call(bash('npm test'))
  await $.turn.complete(done)

  await clock.settle()
  expect(w.sounds.map(sound => sound.asset)).toEqual(['sounds/failure.wav', 'sounds/failure.wav', 'sounds/finish.wav'])
})

test('a stopped turn plays nothing, and a denied call is no failure', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.turn.complete({ ...done, isAborted: true, reason: 'aborted' })
  await $.turn.start(begin)
  w.tools = 'deny'
  await $.tool.call(bash('rm -rf build'))
  await $.turn.complete(done)
  await clock.settle()
  expect(w.sounds.map(sound => sound.asset)).toEqual(['sounds/finish.wav'])
})

test('a clip that cannot play goes to the debug log and costs the turn nothing', async ($, on) => {
  const w = world()
  w.canPlay = false
  const clock = engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  const end = await $.turn.complete(done)
  await clock.settle()
  expect(end.text).toBe('')
  expect(w.logs.some(line => line.startsWith('playing finish failed'))).toBe(true)
})

test('the lamp comes on by itself when dusk falls between turns', async ($, on) => {
  const w = world()
  const clock = engine(on, w, new Date(2026, 10, 17, 16, 55).getTime())
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  await clock.advance(10 * MINUTE)
  expect(w.themes).toHaveLength(2)
  expect(w.themes[1]?.colors?.label).toBe('Pixel Room Lamplight')
  expect(sceneOf(w.themes[1])).toBe('room-b')
  // Nothing changes on the next tick.
  await clock.advance(10 * MINUTE)
  expect(w.themes).toHaveLength(2)
})

test('the backdrop draws on desktop and mobile, and passes on what is not its own', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP('room-a'), surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props.source)).toStartWith('<svg')
    expect(svg?.props.isInteractive).toBe(true)
    expect(String(svg?.props.alt)).toContain('asleep on the sill')
    await ui.unmount()

    const theirs = await $.ui.mount({ ...BACKDROP('room-a', 'someone-else'), surface })
    expect(await theirs.find({ type: 'Svg' })).toBeUndefined()
    await theirs.unmount()

    const unknown = await $.ui.mount({ ...BACKDROP('lagoon'), surface })
    expect(await unknown.find({ type: 'Svg' })).toBeUndefined()
    await unknown.unmount()
  }
})

test("the spinner speaks of the room, keeps the desktop's step names and any message", async ($, on) => {
  const w = world()
  engine(on, w)
  // Beneath the plugin, the engine draws whatever word it is handed.
  on('ui.render', { component: 'Spinner' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.message ?? e.props.word}</Text>
  })
  await $.session.start(start)
  await $.turn.start(begin)
  const spin = async (surface: 'terminal' | 'desktop', word: string, message: string | null = null, mode = 'thinking' as const) => {
    const ui = await $.ui.mount({ plugin: 'pixel-room', component: 'Spinner', props: { word, message, suffix: '…', mode }, surface })
    const text = (await ui.find({ type: 'Text' }))?.text
    await ui.unmount()
    return text
  }
  const phrase = await spin('terminal', 'Sauteing')
  expect(phrase).not.toBe('Sauteing')
  expect(phrase).toMatch(/cat|Rain|lamp|Kettle/)
  expect(await spin('desktop', 'Working')).toBe(phrase)
  expect(await spin('desktop', 'Creating notes.md')).toBe('Creating notes.md')
  expect(await spin('terminal', 'Sauteing', 'Compacting conversation')).toBe('Compacting conversation')

  await run($, 'off')
  expect(await spin('terminal', 'Sauteing')).toBe('Sauteing')
})

test('the footer carries one quiet label, on the terminal and the desktop', async ($, on) => {
  const w = world()
  engine(on, w, EVENING)
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.modes.join(' & ')}</Text>
  })
  await $.session.start(start)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'pixel-room', component: 'SessionMode', props: { modes: ['focus'] }, surface })
    expect((await ui.find({ type: 'Text' }))?.text).toBe('focus & raining · lamp on')
    await ui.unmount()
  }
})

test('the card opens as a widget on the desktop, once, and never by itself elsewhere', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  expect(w.opens).toEqual([{ id: 'pixel-room', title: 'Pixel Room', placement: 'widget' }])
})

test('a terminal session opens no card until asked', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(w.opens).toHaveLength(0)
  expect(await run($, 'card')).toBe('The room card is open.')
  expect(w.opens).toEqual([{ id: 'pixel-room', title: 'Pixel Room' }])
})

test('the card draws the cat and the session, in full docked and as a glance in a widget', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.tool.call(bash('npm test'))

  const ui = await $.ui.mount({ ...PANE('dock'), surface: 'desktop' })
  expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toBe('The cat, watching you work; 0 cups · plant perky')
  expect((await ui.find({ type: 'Text', text: /The cat is/ }))?.text).toBe('The cat is watching you work.')
  await ui.unmount()

  await $.turn.complete(done)
  const glance = await $.ui.mount({ ...PANE('widget'), surface: 'desktop' })
  expect(String((await glance.find({ type: 'Svg' }))?.props.source)).toContain('viewBox="0 0 48 34"')
  expect((await glance.find({ type: 'Text' }))?.text).toBe('asleep on the sill')
  await glance.unmount()

  // The terminal has no Svg: words in its place.
  const plain = await $.ui.mount({ ...PANE('inline'), surface: 'terminal' })
  expect((await plain.find({ type: 'Text', text: /cup/ }))?.text).toBe('raining · lamp off · 1 cup · plant perky')
  await plain.unmount()
})

test('a card value an earlier version stored is declined', async ($, on) => {
  on('state.get', () => ({ value: { value: { mood: 'old' }, version: 1 } }) as never)
  const ui = await $.ui.mount({ ...PANE('dock'), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /The cat is/ }))?.text).toBe('The cat is asleep on the sill.')
  await ui.unmount()
})

test('/pixel-room and its words answer as documented', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)

  expect(await run($, '')).toBe(
    'Rain on the glass, a grey afternoon. The cat is asleep on the sill.\n0 cups so far; the plant looks neutral. Sounds are on, softly.\nThe room is drawn behind this window.',
  )

  expect(await run($, 'mute')).toBe('Sounds are muted. /pixel-room unmute brings them back.')
  expect(w.store.get('muted')).toBe(true)
  await $.turn.start(begin)
  await $.turn.complete(done)
  await clock.settle()
  expect(w.sounds).toHaveLength(0)
  expect(await run($, 'unmute')).toBe('Sounds are on.')
  expect(w.store.has('muted')).toBe(false)

  expect(await run($, 'card off')).toBe('The room card is put away, here and in later sessions. /pixel-room card on brings it back.')
  expect(w.store.get('card')).toBe(false)
  expect(w.closes).toEqual(['pixel-room'])
  expect(await run($, 'card  ON')).toBe('The room card is back.')
  expect(w.store.has('card')).toBe(false)

  expect(await run($, 'off')).toBe('Pixel Room is off, its card and sounds too. /pixel-room on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)
  const before = w.themes.length
  await $.turn.start(begin)
  await $.turn.complete(done)
  await clock.settle()
  expect(w.themes).toHaveLength(before) // off: no theme, no sound
  expect(w.sounds).toHaveLength(0)
  expect(await run($, '')).toContain('The room is dark: /pixel-room on lights it again.')

  expect(await run($, ' ON ')).toBe('Pixel Room is on.')
  expect(w.store.has('enabled')).toBe(false)
  expect(w.themes).toHaveLength(before + 1)

  expect(await run($, 'meow')).toBe('Try /pixel-room, or off, on, mute, unmute, card, card off or card on.')
})

test('the summary says when this window draws no backdrops', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(await run($, '')).toContain("This window doesn't draw backdrops; the room shows in the desktop and mobile apps.")
})

test('a later session that was turned off, muted or put its card away stays so', async ($, on) => {
  const w = world({ enabled: false, muted: true, card: false })
  const clock = engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(0)
  expect(w.opens).toHaveLength(0)
  await $.turn.start(begin)
  await $.turn.complete(done)
  await clock.settle()
  expect(w.sounds).toHaveLength(0)
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
  await $.tool.call(bash('npm test'))
  await $.turn.complete(done)
  expect([...w.store.keys()]).toEqual([])
})
