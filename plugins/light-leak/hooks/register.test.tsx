import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ThemeSetArgs } from 'claude-code'

import { askedOf, bounce, skyAt, standsAfter, statusOf, yieldsAtStart } from './register'

// Local times, so the hour reads the same in any time zone.
const NOON = new Date(2026, 10, 20, 12).getTime()
const MINUTE = 60_000
const HELD = 'Held back by the themes picker: another theme is kept'

type World = {
  store: Map<string, unknown>
  /** Every theme set that reached the engine. */
  themes: ThemeSetArgs[]
  clears: number
  /** How the engine answers a set: drawn by a window, standing for a window yet to attach, or held back above it. */
  answer: 'drawn' | 'waiting' | 'held'
  /** How the engine answers the next tool calls. */
  tools: 'ok' | 'error' | 'deny'
}

const world = (entries: Record<string, unknown> = {}): World => ({
  store: new Map(Object.entries(entries)),
  themes: [],
  clears: 0,
  answer: 'drawn',
  tools: 'ok',
})

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World, now = NOON) {
  const clock = mock.clock(on, { now })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'light-leak' } }))
  on('theme.set', (_$, e) => {
    if (w.answer === 'held') return { value: { isDrawn: false, reason: HELD } } as never
    w.themes.push(e)
    return {
      value: w.answer === 'drawn' ? { isDrawn: true, requestId: 'backdrop' } : { isDrawn: false, requestId: 'backdrop', reason: 'no window draws themes' },
    } as never
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
const run = async ($: Engine, args: string) => (await $.command.run({ command: 'light-leak', args } as never)).text

const BACKDROP = (plugin = 'light-leak', scene = 'light-leak') =>
  ({
    plugin: 'light-leak',
    component: 'Backdrop',
    props: { scene, plugin, glass: { blur: 4, tint: '#151210', opacity: 0.28 }, overrideColorScheme: 'dark' },
  }) as const

/** The values the backdrop hands its shader on a surface. */
async function values($: Engine, surface: 'desktop' | 'mobile' = 'desktop'): Promise<Record<string, unknown>> {
  const ui = await $.ui.mount({ ...BACKDROP(), surface })
  const shader = await ui.find({ type: 'Shader' })
  await ui.unmount()
  return shader?.props.values as Record<string, unknown>
}

const RESTING = { work: 0, calls: 0, errs: 0, turns: 0, sends: 0, night: 0, warm: 0 }

test('the start sets the theme: its scene, dark colours under its label, and the soft glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(w.themes).toHaveLength(1)
  const set = w.themes[0]
  expect(set?.colors?.label).toBe('Light Leak')
  expect(set?.overrideColorScheme).toBe('dark')
  expect(set?.backdrop).toEqual({ scene: 'light-leak', glass: { blur: 4, tint: '#151210', opacity: 0.28 } })
})

test('a stored off sets no theme at the start, and a stored frosted glass is used', async ($, on) => {
  const off = world({ enabled: false })
  engine(on, off)
  await $.session.start(start)
  expect(off.themes).toHaveLength(0)
})

test('a stored frosted glass is used at the start', async ($, on) => {
  const w = world({ glass: 'frosted' })
  engine(on, w)
  await $.session.start(start)
  expect(w.themes[0]?.backdrop).toMatchObject({ glass: { blur: 16, tint: '#151210', opacity: 0.5 } })
})

// Another plugin's theme can't be set from a test (a test's hooks may make only the calls the plugin's
// own scan lists), so what decides whose theme stands is tested here as the plain functions the hooks call.
test("a set stands when a window draws it or it waits for one; a held or denied set leaves whoever stood", () => {
  expect(standsAfter(null, 'light-leak', { isDrawn: true, requestId: 'backdrop' })).toBe('light-leak')
  expect(standsAfter('light-leak', 'other', { isDrawn: true, requestId: 'backdrop' })).toBe('other')
  expect(standsAfter('other', 'light-leak', { isDrawn: false, requestId: 'backdrop', reason: 'no window draws themes' })).toBe('light-leak')
  expect(standsAfter('other', 'light-leak', { isDrawn: false, reason: HELD })).toBe('other')
  expect(standsAfter('other', 'light-leak', undefined)).toBe('other')
})

test('the start yields to another theme only while this one was never asked for by name', () => {
  expect(yieldsAtStart(undefined, 'other')).toBe(true)
  expect(yieldsAtStart(true, 'other')).toBe(false)
  expect(yieldsAtStart(undefined, null)).toBe(false)
  expect(yieldsAtStart(undefined, 'light-leak')).toBe(false)
})

test('the status names another theme in its place, or no theme at all', () => {
  const drawn = { isDrawn: true, requestId: 'backdrop' } as const
  expect(statusOf({ isOn: true, standing: 'other', lastSet: drawn })).toBe('Light Leak is on, but another theme is showing. /light-leak on brings it back.')
  expect(statusOf({ isOn: true, standing: 'other', lastSet: undefined })).toBe('Light Leak is on, but another theme is showing. /light-leak on brings it back.')
  expect(statusOf({ isOn: true, standing: null, lastSet: drawn })).toBe('Light Leak is on, but no theme is showing. /light-leak on brings it back.')
  expect(statusOf({ isOn: false, standing: 'other', lastSet: drawn })).toBe('Light Leak is off. /light-leak on brings it back.')
})

test("the themes picker's requests: a write of its ask that names this theme carries the words to run", () => {
  expect(askedOf({ plugin: 'themes', key: 'ask', value: { id: 3, plugin: 'light-leak', words: 'glass clear' } })).toBe('glass clear')
  expect(askedOf({ plugin: 'themes', key: 'ask', value: { id: 4, plugin: 'light-leak', words: 'on' } })).toBe('on')
  // Asked of another theme, another of the picker's values, another plugin's value, or nothing yet.
  expect(askedOf({ plugin: 'themes', key: 'ask', value: { id: 5, plugin: 'someone-else', words: 'on' } })).toBeUndefined()
  expect(askedOf({ plugin: 'themes', key: 'band', value: { plugin: 'light-leak', words: 'on' } })).toBeUndefined()
  expect(askedOf({ plugin: 'someone-else', key: 'ask', value: { plugin: 'light-leak', words: 'on' } })).toBeUndefined()
  expect(askedOf({ plugin: 'themes', key: 'ask', value: null })).toBeUndefined()
  expect(askedOf(null)).toBeUndefined()
})

test('/light-leak says whether it is drawn here, and the glass', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  expect(await run($, '')).toBe('Light Leak is on, drawn behind this window.\nThe glass is soft.')
  await run($, 'off')
  expect(await run($, '')).toBe('Light Leak is off. /light-leak on brings it back.\nThe glass is soft.')
})

test('/light-leak says why nothing draws it: no window here, or held back by another plugin', async ($, on) => {
  const waiting = world()
  waiting.answer = 'waiting'
  engine(on, waiting)
  await $.session.start({ ...start, surface: 'terminal' })
  expect(await run($, '')).toBe(
    'Light Leak is on, but nothing draws it here: no window draws themes. It shows in the Claude desktop app.\nThe glass is soft.',
  )
})

test('/light-leak names what held its theme back', async ($, on) => {
  const w = world()
  w.answer = 'held'
  engine(on, w)
  await $.session.start(start)
  expect(await run($, '')).toBe(`Light Leak is on, but it isn't drawn: ${HELD}.\nThe glass is soft.`)
  // Its theme never stood: an off clears nothing.
  await run($, 'off')
  expect(w.clears).toBe(0)
})

test('/light-leak on, off, glass and help answer as documented', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)

  expect(await run($, 'off')).toBe('Light Leak is off. /light-leak on brings it back.')
  expect(w.clears).toBe(1)
  expect(w.store.get('enabled')).toBe(false)

  expect(await run($, ' ON ')).toBe('Light Leak is on.')
  expect(w.store.get('enabled')).toBe(true)
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

  expect(await run($, 'glass foggy')).toBe('The glass is soft. Try /light-leak glass clear, soft or frosted.')
  expect(await run($, 'glass')).toBe('The glass is soft. Try /light-leak glass clear, soft or frosted.')
  expect(w.themes).toHaveLength(5)

  expect(await run($, 'brighter')).toBe('Try /light-leak, or on, off, glass clear|soft|frosted, or forget.')
})

test('/light-leak glass while off keeps the choice and sets no theme', async ($, on) => {
  const w = world({ enabled: false })
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'glass frosted')).toBe('The glass is frosted.')
  expect(w.store.get('glass')).toBe('frosted')
  expect(w.themes).toHaveLength(0)
})

test('/light-leak forget deletes everything it kept, and clears only a theme of its own', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'glass frosted')
  expect(await run($, 'forget')).toBe('Light Leak forgot what it kept and is off until it loads again.')
  expect([...w.store.keys()]).toEqual([])
  expect(w.clears).toBe(1)
  // Its theme is gone already: a second forget clears nothing.
  await run($, 'forget')
  expect(w.clears).toBe(1)
})

test('once its theme is cleared, off and forget clear nothing more, and a clear, resume or fork sets nothing', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await run($, 'off')
  expect(w.clears).toBe(1)
  // Its own clear left no theme standing.
  await $.classic.SessionStart({ source: 'clear' })
  expect(w.themes).toHaveLength(1)
  await run($, 'forget')
  expect(w.clears).toBe(1)
})

test('glass while its theme is not showing keeps the choice and covers nothing', async ($, on) => {
  const w = world()
  w.answer = 'held'
  engine(on, w)
  await $.session.start(start)
  expect(await run($, 'glass frosted')).toBe('The glass is frosted.')
  expect(w.store.get('glass')).toBe('frosted')
  expect(w.themes).toHaveLength(0)
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
    expect(String(svgs[0]?.props.alt).toLowerCase()).toContain('amber light')
    await ui.unmount()
    expect(await values($, surface)).toEqual(RESTING)
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

  // A stopped turn rests without its finish.
  await $.turn.start(begin)
  await $.turn.complete({ ...done, isAborted: true })
  expect(await values($)).toMatchObject({ work: 0, turns: 1, sends: 2 })

  // A turn with no typed prompt, a continuation or a wake-up, is work but no message sent.
  await $.turn.start({ ...begin, text: '' })
  expect(await values($)).toMatchObject({ work: 1, sends: 2 })
})

test("a subagent's turns and calls change nothing", async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await $.turn.start({ ...begin, agentId: 'a1' })
  w.tools = 'error'
  await $.tool.call({ ...read, agentId: 'a1' } as never)
  await $.turn.complete({ ...done, agentId: 'a1' })
  expect(await values($)).toEqual(RESTING)
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

    const other = await $.ui.mount({ ...BACKDROP('light-leak', 'lagoon'), surface })
    expect(await other.find({ type: 'Shader' })).toBeUndefined()
    expect(await other.find({ type: 'Svg' })).toBeUndefined()
    await other.unmount()
  }
})

test('night and warmth follow the clock between turns, as values, never a new theme', async ($, on) => {
  const w = world()
  const clock = engine(on, w, new Date(2026, 10, 20, 18, 55).getTime())
  await $.session.start(start)
  expect(await values($)).toMatchObject(skyAt(18.9))
  const dusk = await values($)
  await clock.advance(10 * MINUTE)
  expect(await values($)).toMatchObject(skyAt(19.1))
  expect((await values($)).night).toBeGreaterThan(dusk.night as number)
  expect(w.themes).toHaveLength(1)
})

test('night and warmth are smooth across midnight, and peak at the right hours', () => {
  expect(skyAt(23.9)).toEqual(skyAt(0))
  expect(skyAt(0).night).toBe(1)
  expect(skyAt(12)).toEqual({ night: 0, warm: 0 })
  expect(skyAt(6).warm).toBe(1)
  expect(skyAt(18.5).warm).toBe(1)
  // Every step of a day, ten minutes apart, moves night and warmth by a little at most.
  for (let at = 0; at < 24; at += 1 / 6) {
    const now = skyAt(at)
    const later = skyAt((at + 1 / 6) % 24)
    expect(Math.abs(later.night - now.night)).toBeLessThan(0.15)
    expect(Math.abs(later.warm - now.warm)).toBeLessThan(0.15)
  }
})

test('a count reaches the shader one step at a time, turning at its top instead of wrapping', () => {
  expect([0, 1, 1022, 1023, 1024, 1025, 2045, 2046, 2047].map(bounce)).toEqual([0, 1, 1022, 1023, 1022, 1021, 1, 0, 1])
  for (let count = 0; count < 5000; count += 1) expect(Math.abs(bounce(count + 1) - bounce(count))).toBe(1)
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
