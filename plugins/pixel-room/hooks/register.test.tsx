import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, PaneOpenArgs, ThemeSetArgs } from 'claude-code'

import { standsAfter, whereLine, yieldsAtStart } from './register'

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
  /** What a tool answers when it goes through, by tool. */
  results: Record<string, unknown>
  /** How long, in milliseconds, each tool call takes. */
  wait: number
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
  results: {},
  wait: 0,
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World, now = NOON) {
  const clock = mock.clock(on, { now })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.attach', (_$, e) => ({ clientId: e.clientId }))
  on('command.register', () => ({ value: { command: 'pixel-room' } }))
  on('theme.set', (_$, e) => {
    w.themes.push(e)
    return { value: w.isDrawn ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, requestId: 'backdrop', reason: 'no window draws themes' } } as never
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
  on('store.keys', () => ({ value: [...w.store.keys()] }) as never)
  on('tool.call', async (_$, e) => {
    if (w.wait > 0) await clock.sleep(w.wait)
    return (w.tools === 'deny' ? { deny: 'no' } : w.tools === 'error' ? { isError: true, result: 'failed', text: 'failed' } : { result: w.results[String(e.tool)] ?? {} }) as never
  })
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
  expect(set?.backdrop).toMatchObject({ scene: 'room-a', glass: { blur: 4, tint: '#16121f', opacity: 0.28 } })
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

test('the card never opens by itself, on the desktop or the terminal', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' })
  expect(w.opens).toHaveLength(0)
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
  const card = await ui.find({ type: 'Svg' })
  expect(String(card?.props.alt)).toBe('The cat, watching you work; 0 cups · plant perky')
  expect([card?.props.width, card?.props.height]).toEqual([228, 180])
  expect((await ui.find({ type: 'Text', text: /The cat is/ }))?.text).toBe('The cat is watching you work.')
  await ui.unmount()

  await $.turn.complete(done)
  const glance = await $.ui.mount({ ...PANE('widget'), surface: 'desktop' })
  const peek = await glance.find({ type: 'Svg' })
  expect(String(peek?.props.source)).toContain('viewBox="0 0 48 34"')
  expect([peek?.props.width, peek?.props.height]).toEqual([144, 102])
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
    'Rain on the glass, the lamp off.\nThe cat is asleep on the sill.\n0 cups so far; the plant looks neutral. Sounds are on, softly.\nThe room is drawn behind this window.',
  )

  const themesBefore = w.themes.length
  expect(await run($, 'glass clear')).toBe('The glass is clear.')
  expect(w.store.get('glass')).toBe('clear')
  expect(w.themes.at(-1)?.backdrop).toMatchObject({ glass: false })
  expect(w.themes.length).toBe(themesBefore + 1)
  expect(await run($, 'glass foggy')).toBe('The glass is clear. Try /pixel-room glass clear, soft or frosted.')
  expect(await run($, 'glass soft')).toBe('The glass is soft.')
  expect(w.store.has('glass')).toBe(false)

  expect(await run($, 'mute')).toBe('Sounds are muted. /pixel-room unmute brings them back.')
  expect(w.store.get('muted')).toBe(true)
  await $.turn.start(begin)
  await $.turn.complete(done)
  await clock.settle()
  expect(w.sounds).toHaveLength(0)
  expect(await run($, 'unmute')).toBe('Sounds are on.')
  expect(w.store.has('muted')).toBe(false)

  expect(await run($, 'card off')).toBe('The room card is put away. /pixel-room card brings it back.')
  expect(w.closes).toEqual(['pixel-room'])
  expect(await run($, 'card  ON')).toBe('The room card is open.')
  expect(w.opens.at(-1)).toEqual({ id: 'pixel-room', title: 'Pixel Room', placement: 'widget' })
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
  // Turned on by name: kept, so the room takes its place at a start even beside another theme.
  expect(w.store.get('enabled')).toBe(true)
  expect(w.themes).toHaveLength(before + 1)

  expect(await run($, 'meow')).toBe(
    'Try /pixel-room, or off, on, mute, unmute, pet, glass clear|soft|frosted, weather [rain|drizzle|snow|fog|clear|auto], card, card off, card on or forget.',
  )
})

test('/pixel-room forget deletes everything it kept, and clears only a theme of its own', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'mute')
  await run($, 'card off')
  expect(await run($, 'forget')).toBe('Pixel Room forgot what it kept and is off until it loads again.')
  expect([...w.store.keys()]).toEqual([])
  expect(w.clears).toBe(1)
  // Off already: a forget leaves whatever theme stands alone.
  await run($, 'forget')
  expect(w.clears).toBe(1)
})

test('the summary says why nothing draws the room here', async ($, on) => {
  const w = world()
  w.isDrawn = false
  engine(on, w)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(await run($, '')).toContain('Nothing draws the room here: no window draws themes. It shows in the desktop and mobile apps.')
})

// Another plugin's theme can't be set from a test (a test's hooks may make only the calls the plugin's
// own scan lists), so what decides whose theme stands is tested as the plain functions the hooks call.
test("a set stands when a window draws it or it waits for one; a held or denied set leaves whoever stood", () => {
  expect(standsAfter(null, 'pixel-room', { isDrawn: true, requestId: 'backdrop' })).toBe('pixel-room')
  expect(standsAfter('pixel-room', 'silk', { isDrawn: true, requestId: 'backdrop' })).toBe('silk')
  expect(standsAfter('silk', 'pixel-room', { isDrawn: false, requestId: 'backdrop', reason: 'no window draws themes' })).toBe('pixel-room')
  expect(standsAfter('silk', 'pixel-room', { isDrawn: false, reason: 'held back' })).toBe('silk')
  expect(standsAfter('silk', 'pixel-room', undefined)).toBe('silk')
})

test('the start yields to another theme only while the room was never turned on by name', () => {
  expect(yieldsAtStart(undefined, 'silk')).toBe(true)
  expect(yieldsAtStart(true, 'silk')).toBe(false)
  expect(yieldsAtStart(undefined, null)).toBe(false)
  expect(yieldsAtStart(undefined, 'pixel-room')).toBe(false)
})

test("the summary's last line: dark, another theme in the room's place, drawn, held, or waiting for a window", () => {
  const drawn = { isDrawn: true, requestId: 'backdrop' } as const
  expect(whereLine({ isOn: false, standing: 'pixel-room', lastSet: drawn })).toBe('The room is dark: /pixel-room on lights it again.')
  expect(whereLine({ isOn: true, standing: 'silk', lastSet: drawn })).toBe('Another theme is showing: /pixel-room on brings the room back.')
  expect(whereLine({ isOn: true, standing: 'pixel-room', lastSet: drawn })).toBe('The room is drawn behind this window.')
  expect(whereLine({ isOn: true, standing: null, lastSet: { isDrawn: false, reason: 'Held back by the themes picker' } })).toBe(
    "The room isn't drawn: Held back by the themes picker.",
  )
  expect(whereLine({ isOn: true, standing: null, lastSet: undefined })).toBeUndefined()
})

test('once the room is off, a clear, resume or fork leaves the theme alone, and forget clears nothing more', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'off')
  expect(w.clears).toBe(1)
  const before = w.themes.length
  await $.classic.SessionStart({ source: 'clear' })
  expect(w.themes).toHaveLength(before)
  await run($, 'forget')
  expect(w.clears).toBe(1)
})

test('a later session that was turned off or muted stays so', async ($, on) => {
  const w = world({ enabled: false, muted: true })
  const clock = engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(0)
  expect(w.opens).toHaveLength(0)
  await $.turn.start(begin)
  await $.turn.complete(done)
  await clock.settle()
  expect(w.sounds).toHaveLength(0)
})

test("a start clears what 0.2's band and 0.1's self-opening card kept, and keeps the rest", async ($, on) => {
  const w = world({ band: false, card: false, muted: true })
  engine(on, w)
  await $.session.start(start)
  expect([...w.store.keys()]).toEqual(['muted'])
  expect(w.opens).toHaveLength(0)
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

// ---------------------------------------------------------------- 0.2.0: the weather, petting, notes and moths

async function altOf($: Engine, scene: string): Promise<string> {
  const ui = await $.ui.mount({ ...BACKDROP(scene), surface: 'desktop' })
  const alt = String((await ui.find({ type: 'Svg' }))?.props.alt)
  await ui.unmount()
  return alt
}

async function footer($: Engine): Promise<string | undefined> {
  const ui = await $.ui.mount({ plugin: 'pixel-room', component: 'SessionMode', props: { modes: [] }, surface: 'desktop' })
  const text = (await ui.find({ type: 'Text' }))?.text
  await ui.unmount()
  return text
}

async function tally($: Engine): Promise<string | undefined> {
  const ui = await $.ui.mount({ ...PANE('inline'), surface: 'terminal' })
  const text = (await ui.find({ type: 'Text', text: /cup/ }))?.text
  await ui.unmount()
  return text
}

const sessionMode = (on: On) =>
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.modes.join(' & ')}</Text>
  })

test('/pixel-room weather pins a weather across sessions, and auto gives back the day\'s own', async ($, on) => {
  const w = world()
  engine(on, w, EVENING)
  sessionMode(on)
  await $.session.start(start)
  expect(await run($, 'weather')).toBe("Rain today: the room's own weather, not a forecast.\nThe moon is at first quarter.")
  expect(await footer($)).toBe('raining · lamp on')

  const before = w.themes.length
  expect(await run($, 'weather SNOW')).toBe("The weather is pinned to snow, here and in later sessions. /pixel-room weather auto brings back the day's own.")
  expect(w.store.get('weather')).toBe('snow')
  expect(w.themes).toHaveLength(before + 1)
  expect(await footer($)).toBe('snowing · lamp on')
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).toContain('snow falling outside')
  expect(await run($, 'weather')).toBe("The weather is pinned to snow. /pixel-room weather auto brings back the day's own.\nThe moon is at first quarter.")
  expect(await run($, 'weather hail')).toBe("Try /pixel-room weather rain, drizzle, snow, fog or clear to pin one, or weather auto for the day's own.")

  expect(await run($, 'weather auto')).toBe("Back to the day's own weather: rain today.")
  expect(w.store.has('weather')).toBe(false)
  expect(await footer($)).toBe('raining · lamp on')
  await run($, 'weather fog')
  expect(await run($, 'weather day')).toBe("Back to the day's own weather: rain today.")
  expect(w.store.has('weather')).toBe(false)
})

test('a later session keeps the pinned weather', async ($, on) => {
  const w = world({ weather: 'clear' })
  engine(on, w, EVENING)
  sessionMode(on)
  await $.session.start(start)
  expect(await footer($)).toBe('clear · first quarter')
  expect(await altOf($, 'room-a')).toContain('a first-quarter moon in a clear sky')
})

// The kit raises no `ui.pointer`, so petting is tested through `/pixel-room pet`, which a click on the backdrop runs the same way.
test('petting the cat: hearts in the scene, a purr, at most once every three seconds, and a hush when muted', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  const before = w.themes.length
  expect(await run($, 'pet')).toBe('You pet the cat. It purrs.')
  await clock.settle()
  expect(w.themes).toHaveLength(before + 1)
  expect(w.sounds).toEqual([{ asset: 'sounds/purr.wav', gain: 0.5 }])
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).toContain('asleep on the sill, purring')

  // Too soon: nothing more.
  await clock.advance(1000)
  expect(await run($, 'pet')).toBe('The cat is still purring from the last one.')
  await clock.settle()
  expect(w.themes).toHaveLength(before + 1)
  expect(w.sounds).toHaveLength(1)

  // The hearts leave the scene after a few seconds, with no redraw of the backdrop.
  await clock.advance(5000)
  expect(w.themes).toHaveLength(before + 1)
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).not.toContain('purring')

  // Muted, the hearts come without the purr.
  await run($, 'mute')
  expect(await run($, 'pet')).toBe('You pet the cat. It purrs, too softly to hear.')
  await clock.settle()
  expect(w.themes).toHaveLength(before + 2)
  expect(w.sounds).toHaveLength(1)

  await run($, 'off')
  expect(await run($, 'pet')).toBe('The room is dark: /pixel-room on lights it again.')
})

test('a git push that goes through sends a paper plane past the window', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.tool.call(bash('git status'))
  const before = w.themes.length
  await $.tool.call(bash('git add -A && git push origin main'))
  expect(w.themes).toHaveLength(before + 1)
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).toContain('a paper plane gliding past the window')
  await clock.advance(5000)
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).not.toContain('paper plane')

  // In the background, or failed, it sends nothing.
  await $.tool.call({ ...bash('git push'), run_in_background: true } as never)
  w.tools = 'error'
  await $.tool.call(bash('git push'))
  w.tools = 'ok'
  await $.tool.call(bash('git pull'))
  expect(w.themes).toHaveLength(before + 2) // the failed push startled the cat, nothing more
})

test("Claude's todo list and task list reach the room as notes, a few seconds later and in one redraw", async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.tool.call(read('/home/me/desk/a.ts'))
  const before = w.themes.length
  const todos = (...statuses: string[]) => statuses.map((status, i) => ({ content: `step ${i}`, status, activeForm: `Doing step ${i}` }))
  await $.tool.call({ tool: 'TodoWrite', todos: todos('in_progress', 'pending', 'pending') } as never)
  await $.tool.call({ tool: 'TodoWrite', todos: todos('completed', 'in_progress', 'pending') } as never)
  expect(w.themes).toHaveLength(before)
  await clock.advance(4000)
  expect(w.themes).toHaveLength(before + 1)
  expect(await tally($)).toBe('raining · lamp off · 0 cups · plant neutral · 1 of 3 notes done')
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).toContain('three notes on the corkboard')

  // Tasks count beside the todos, by their ids.
  w.results.TaskCreate = { task: { id: '7', subject: 'Ship it' } }
  await $.tool.call({ tool: 'TaskCreate', subject: 'Ship it', description: 'Ship it' } as never)
  w.results.TaskUpdate = { success: true, taskId: '7', updatedFields: ['status'] }
  await $.tool.call({ tool: 'TaskUpdate', taskId: '7', status: 'completed' } as never)
  await clock.advance(4000)
  expect(w.themes).toHaveLength(before + 2)
  expect(await tally($)).toContain('2 of 4 notes done')
  await $.tool.call({ tool: 'TaskUpdate', taskId: '7', status: 'deleted' } as never)
  await clock.advance(4000)
  expect(await tally($)).toContain('1 of 3 notes done')
})

test('subagents in flight are moths at the lamp, three at most', async ($, on) => {
  const w = world()
  const clock = engine(on, w, EVENING)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.tool.call(read('/home/me/desk/a.ts'))
  const before = w.themes.length
  w.wait = 20_000
  const agent = (n: number) => ({ tool: 'Agent', description: `look ${n}`, prompt: 'look around', run_in_background: false }) as never
  const calls = [1, 2, 3, 4].map(n => $.tool.call(agent(n)))
  await clock.advance(4000)
  expect(w.themes).toHaveLength(before + 1)
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).toContain('three moths at the lamp')

  await clock.advance(16_000)
  await Promise.all(calls)
  await clock.advance(4000)
  expect(w.themes).toHaveLength(before + 2)
  expect(await altOf($, sceneOf(w.themes.at(-1)) ?? '')).not.toContain('moth')
})

test('the monitor rests a while after a turn, with a redraw of its own', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  await $.turn.start(begin)
  await $.turn.complete(done)
  const before = w.themes.length
  await clock.advance(10 * MINUTE)
  expect(w.themes).toHaveLength(before + 1)
  await clock.advance(10 * MINUTE)
  expect(w.themes).toHaveLength(before + 1)
})

test("on the terminal a turn's closing line takes the room's word, keeping its time", async ($, on) => {
  const w = world()
  engine(on, w)
  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{`${e.props.word} for ${e.props.durationMs / 1000}s`}</Text>
  })
  await $.session.start({ ...start, surface: 'terminal' })
  const line = async (props: Record<string, unknown> = {}, surface: 'terminal' | 'desktop' = 'terminal') => {
    const ui = await $.ui.mount({ plugin: 'pixel-room', component: 'TurnDuration', requestId: 'm1', props: { word: 'Baked', durationMs: 3000, ...props } as never, surface })
    const text = (await ui.find({ type: 'Text' }))?.text
    await ui.unmount()
    return text
  }
  const first = await line()
  expect(first).toMatch(/^(Steeped|Purred|Mulled|Brewed|Drifted) for 3s$/)
  expect(await line()).toBe(first)
  expect(await line({ isExpanded: true })).toBe('Baked for 3s')
  expect(await line({ waitingFor: { agents: [], workflows: 1 } })).toBe('Baked for 3s')
  await run($, 'off')
  expect(await line()).toBe('Baked for 3s')
})

test('/pixel-room describes the weather, the notes and the moths too', async ($, on) => {
  const w = world({ weather: 'snow' })
  engine(on, w, EVENING)
  await $.session.start(start)
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'a', status: 'completed', activeForm: 'A' }, { content: 'b', status: 'pending', activeForm: 'B' }] } as never)
  expect(await run($, '')).toBe(
    'Snow falling past the window, the lamp lit. A first-quarter moon behind the snow.\nThe cat is asleep on the sill. Two notes on the corkboard, one done.\n0 cups so far; the plant looks neutral. Sounds are on, softly.\nThe room is drawn behind this window.',
  )
})

test('forget deletes the weather too', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'weather fog')
  await run($, 'glass frosted')
  await run($, 'forget')
  expect([...w.store.keys()]).toEqual([])
})
