import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { entryOf } from './catalog'
import { isHeld, turnsOnBy } from './plan'

const NOW = Date.UTC(2026, 10, 17, 12)
const SURFACES = ['terminal', 'desktop'] as const

type World = {
  store: Map<string, unknown>
  /** Plugins whose commands the session lists. */
  plugins: string[]
  /** Every theme command run, as `/<command> <args>`. */
  runs: string[]
  /** Every host command run, by its argv. */
  argv: string[][]
  /** The exit code the host's commands answer. */
  exitCode: number
}

const world = (plugins: string[] = ['pixel-room']): World => ({
  store: new Map(),
  plugins,
  runs: [],
  argv: [],
  exitCode: 0,
})

const COMMAND_OF: Record<string, string> = {
  'pixel-room': 'pixel-room',
  'theme-examples': 'custom-theme',
}

// The engine beneath the plugin: each hook answers as the engine would, from `w`.
function engine(on: On, w: World) {
  const clock = mock.clock(on, { now: NOW })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('command.list', () => ({
    value: w.plugins.map(plugin => ({ name: COMMAND_OF[plugin] ?? plugin, description: '', source: 'plugin' as const, plugin })),
  }))
  on('command.run', (_$, e) => {
    w.runs.push(`/${e.command} ${e.args}`.trim())
    return { text: `${e.command} did ${e.args}` }
  })
  on('process.run', (_$, e) => {
    w.argv.push([...e.argv])
    return { value: { exitCode: w.exitCode, stdout: '', stderr: w.exitCode === 0 ? '' : 'Plugin not found' } } as never
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
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return clock
}

const BAND = (surface: (typeof SURFACES)[number], bodyColumns = 160, maxRows = 12) =>
  ({
    plugin: 'themes',
    component: 'AbovePrompt',
    surface,
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows, bodyColumns, scroll: { offset: 0, bodyRows: maxRows }, view: {} },
  }) as const

const start = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const themes = ($: { command: { run: (e: never) => Promise<{ text?: string }> } }, args = '') =>
  $.command.run({ command: 'themes', args } as never)

for (const surface of SURFACES) {
  test(`${surface}: /themes opens a strip of every theme, and names who built it`, async ($, on) => {
    const w = world(['pixel-room', 'theme-examples'])
    engine(on, w)
    await $.session.start(start)
    expect((await themes($)).text).toBe('Pick a theme in the band above the prompt.')

    // Wide enough for one page of all 25.
    const ui = await $.ui.mount(BAND(surface, 1000))
    for (const id of ['pixel-room', 'mesh-glow', 'light-leak', 'silk', 'pearl', 'honu-lagoon', 'ember']) {
      expect(await ui.find({ key: `tile:${id}` })).toBeDefined()
    }
    const words = async () => (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join(' ')
    if (surface === 'terminal') {
      // The text strip tags each run of tiles with its author.
      expect(await words()).toContain('Samarth')
      expect(await words()).toContain('Anthropic')
    } else {
      // The pictures carry titles alone; the line under them names the picked theme's author.
      expect(await words()).toContain('by Samarth')
      expect(await words()).not.toContain('by Anthropic')
    }
    // Opening runs nothing: no theme changes until a tile is picked.
    expect(w.runs).toEqual([])
    await ui.press({ key: 'tile:honu-lagoon' })
    expect(await words()).toContain('by Anthropic')
    await ui.unmount()
  })

  test(`${surface}: each quiet backdrop is tried with its own command, and its glass set from the band`, async ($, on) => {
    const w = world(['mesh-glow', 'light-leak', 'silk', 'pearl'])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface, 1000))
    await ui.press({ key: 'tile:mesh-glow' })
    await ui.select({ key: 'opt:mesh-glow:glass', value: 'frosted' })
    await ui.press({ key: 'tile:pearl' })
    await ui.press({ key: 'keep' })
    expect(w.runs).toEqual(['/mesh-glow on', '/mesh-glow glass frosted', '/mesh-glow off', '/pearl on'])
    expect(w.store.get('chosen')).toBe('pearl')
    expect(w.store.get('settings')).toEqual({ 'mesh-glow': { glass: 'frosted' } })
    await ui.unmount()
  })

  test(`${surface}: picking tries a theme live, and the next pick turns the last one off first`, async ($, on) => {
    const w = world(['pixel-room', 'theme-examples'])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))

    await ui.press({ key: 'tile:pixel-room' })
    expect(w.runs).toEqual(['/pixel-room on'])
    await ui.press({ key: 'tile:honu-lagoon' })
    expect(w.runs).toEqual(['/pixel-room on', '/pixel-room off', '/custom-theme honu-lagoon session'])
    // Picking the theme that is already on runs nothing.
    await ui.press({ key: 'tile:honu-lagoon' })
    expect(w.runs).toHaveLength(3)
    await ui.unmount()
  })

  test(`${surface}: an option typed as the theme's command shows as set, and a typed forget clears it`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await $.command.run({ command: 'pixel-room', args: 'glass clear', origin: { kind: 'person' } } as never)
    expect(w.store.get('settings')).toEqual({ 'pixel-room': { glass: 'clear' } })
    await $.command.run({ command: 'pixel-room', args: 'forget', origin: { kind: 'person' } } as never)
    expect(w.store.get('settings')).toEqual({})
  })

  test(`${surface}: Keep keeps the picked theme and closes the band`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:pixel-room' })
    await ui.press({ key: 'keep' })
    expect(w.runs).toEqual(['/pixel-room on'])
    expect(w.store.get('chosen')).toBe('pixel-room')
    expect(await ui.find({ key: 'keep' })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: Cancel puts back the theme that was on`, async ($, on) => {
    const w = world(['pixel-room', 'theme-examples'])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    let ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:pixel-room' })
    await ui.press({ key: 'keep' })
    await ui.unmount()

    await themes($)
    ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:honu-lagoon' })
    await ui.press({ key: 'cancel' })
    expect(w.runs).toEqual(['/pixel-room on', '/pixel-room off', '/custom-theme honu-lagoon session', '/custom-theme off', '/pixel-room on'])
    expect(w.store.get('chosen')).toBe('pixel-room')
    expect(await ui.find({ key: 'cancel' })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: Cancel with nothing on before turns the tried theme off`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:pixel-room' })
    await ui.press({ key: 'cancel' })
    expect(w.runs).toEqual(['/pixel-room on', '/pixel-room off'])
    expect(w.store.has('chosen')).toBe(false)
    await ui.unmount()
  })

  test(`${surface}: a theme's options drive its own command`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:pixel-room' })
    await ui.select({ key: 'opt:pixel-room:glass', value: 'clear' })
    await ui.select({ key: 'opt:pixel-room:sound', value: 'off' })
    // Pixel Room's card is a button that opens the room card, and nothing of it is kept.
    expect(await ui.find({ key: 'opt:pixel-room:card' })).toBeUndefined()
    await ui.press({ key: 'act:pixel-room:card' })
    expect(w.runs).toEqual(['/pixel-room on', '/pixel-room glass clear', '/pixel-room mute', '/pixel-room card'])
    expect(w.store.get('settings')).toEqual({ 'pixel-room': { glass: 'clear', sound: 'off' } })
    await ui.unmount()
  })

  test(`${surface}: Install runs claude plugin install, and asks for /reload-plugins`, async ($, on) => {
    const w = world(['pixel-room'])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    // Anthropic's set is one tile while its plugin is not installed.
    expect(await ui.find({ key: 'tile:honu-lagoon' })).toBeUndefined()
    await ui.press({ key: 'tile:theme-examples' })
    expect(w.runs).toEqual([])
    await ui.press({ key: 'install:theme-examples' })
    expect(w.argv).toEqual([['claude', 'plugin', 'install', 'theme-examples@claude-plugins-official']])
    expect(await ui.find({ type: 'Text', text: /reload-plugins/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: Remove turns the theme off, forgets what it saved, then uninstalls it`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:pixel-room' })
    await ui.press({ key: 'keep' })
    await themes($)
    await ui.press({ key: 'remove:pixel-room' })
    expect(w.argv).toEqual([]) // a yes first
    await ui.press({ key: 'confirm' })
    expect(w.runs).toEqual(['/pixel-room on', '/pixel-room off', '/pixel-room forget'])
    expect(w.argv).toEqual([['claude', 'plugin', 'uninstall', 'pixel-room@samarth']])
    expect(w.store.has('chosen')).toBe(false)
    expect(await ui.find({ type: 'Text', text: /reload-plugins/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: where the host cannot run claude, the band shows the command to run`, async ($, on) => {
    const w = world([])
    w.exitCode = 1
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'install-ours' })
    const ours = ['pixel-room', 'mesh-glow', 'light-leak', 'silk', 'pearl'].map(name => `${name}@samarth`)
    expect(w.argv.map(argv => argv[3])).toEqual(ours)
    const fallback = await ui.find({
      type: 'Text',
      text: 'In a shell: for p in pixel-room mesh-glow light-leak silk pearl; do claude plugin install "$p@samarth"; done',
    })
    expect(fallback).toBeDefined()
    // Too long to sit beside the theme: it has a row of its own, and wraps there rather than being cut off.
    expect(fallback?.props.wrap).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: with none of Samarth's themes installed, Install all by Samarth installs all five`, async ($, on) => {
    const w = world([])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    expect((await ui.find({ key: 'install-ours' }))?.text).toBe('Install all by Samarth')
    await ui.press({ key: 'install-ours' })
    expect(w.argv.map(argv => argv[3])).toEqual(['pixel-room', 'mesh-glow', 'light-leak', 'silk', 'pearl'].map(name => `${name}@samarth`))
    // All five wait on /reload-plugins, so nothing is left to install.
    expect(await ui.find({ key: 'install-ours' })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: with Pixel Room installed, Install the rest by Samarth installs the other four`, async ($, on) => {
    const w = world(['pixel-room'])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    expect((await ui.find({ key: 'install-ours' }))?.text).toBe('Install the rest by Samarth')
    await ui.press({ key: 'install-ours' })
    expect(w.argv.map(argv => argv[3])).toEqual(['mesh-glow', 'light-leak', 'silk', 'pearl'].map(name => `${name}@samarth`))
    await ui.unmount()
  })

  test(`${surface}: with all of Samarth's themes installed, the band offers no Install all`, async ($, on) => {
    const w = world(['pixel-room', 'mesh-glow', 'light-leak', 'silk', 'pearl'])
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    expect(await ui.find({ key: 'install-ours' })).toBeUndefined()
    await ui.unmount()
  })
}

test('a narrow band pages its tiles, and the arrows move through them', async ($, on) => {
  const w = world(['pixel-room', 'theme-examples'])
  engine(on, w)
  await $.session.start(start)
  await themes($)

  const wide = await $.ui.mount(BAND('desktop', 400))
  expect(await wide.findAll({ type: 'Svg' })).toHaveLength(25)
  expect(await wide.find({ key: 'next' })).toBeUndefined()
  await wide.unmount()

  const narrow = await $.ui.mount(BAND('desktop', 50))
  expect(await narrow.findAll({ type: 'Svg' })).toHaveLength(3)
  expect(await narrow.find({ key: 'tile:pixel-room' })).toBeDefined()
  await narrow.press({ key: 'next' })
  expect(await narrow.find({ key: 'tile:pixel-room' })).toBeUndefined()
  expect(await narrow.find({ key: 'tile:silk' })).toBeDefined()
  await narrow.unmount()

  const terminal = await $.ui.mount(BAND('terminal', 60))
  expect(await terminal.find({ key: 'next' })).toBeDefined()
  expect((await terminal.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('tile:')).length).toBeLessThan(25)
  await terminal.unmount()
})

test('the band yields to a survey, never shows unasked, and keeps to its rows', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)

  const unasked = await $.ui.mount(BAND('terminal'))
  expect(await unasked.find({ type: 'Button' })).toBeUndefined()
  await unasked.unmount()

  await themes($)
  const survey = await $.ui.mount({ ...BAND('terminal'), props: { ...BAND('terminal').props, hasSurvey: true } })
  expect(await survey.find({ type: 'Button' })).toBeUndefined()
  await survey.unmount()

  // Two rows of three: the strip, then the picked theme's controls with Cancel and Keep; its name goes.
  const short = await $.ui.mount(BAND('terminal', 60, 2))
  expect(await short.find({ key: 'tile:pixel-room' })).toBeDefined()
  expect(await short.find({ key: 'cancel' })).toBeDefined()
  expect(await short.find({ key: 'keep' })).toBeDefined()
  expect(await short.find({ type: 'Text', text: 'by Samarth' })).toBeUndefined()
  await short.unmount()
})

test('a band short of rows keeps its strip, then the controls with Cancel and Keep, then the theme name', async ($, on) => {
  const w = world()
  engine(on, w)
  await $.session.start(start)
  await themes($)
  const header = { type: 'Text', text: /^Themes$/ }

  // Narrow, the desktop band draws four rows: the header, the strip, the theme's name, and its controls.
  const narrow = await $.ui.mount(BAND('desktop', 60, 3))
  expect(await narrow.find({ key: 'tile:pixel-room' })).toBeDefined()
  expect(await narrow.find({ key: 'opt:pixel-room:glass' })).toBeDefined()
  expect(await narrow.find({ key: 'cancel' })).toBeDefined()
  expect(await narrow.find({ key: 'keep' })).toBeDefined()
  expect(await narrow.find({ type: 'Text', text: 'by Samarth' })).toBeDefined()
  expect(await narrow.find(header)).toBeUndefined()
  expect(await narrow.find({ key: 'install-ours' })).toBeUndefined()
  await narrow.unmount()

  // Wide, it draws three: the header, the strip, and one line of the theme with its controls.
  const wide = await $.ui.mount(BAND('desktop', 160, 2))
  expect(await wide.find({ key: 'tile:pixel-room' })).toBeDefined()
  expect(await wide.find({ key: 'opt:pixel-room:glass' })).toBeDefined()
  expect(await wide.find({ key: 'cancel' })).toBeDefined()
  expect(await wide.find({ key: 'keep' })).toBeDefined()
  expect(await wide.find(header)).toBeUndefined()
  await wide.unmount()

  // One row on the terminal: the strip.
  const terminal = await $.ui.mount(BAND('terminal', 60, 1))
  expect(await terminal.find({ key: 'tile:pixel-room' })).toBeDefined()
  expect(await terminal.find({ key: 'cancel' })).toBeUndefined()
  await terminal.unmount()
})

test("a start drops a saved option its theme no longer has, such as Pixel Room's old Card on/off", async ($, on) => {
  const w = world()
  w.store.set('settings', { 'pixel-room': { glass: 'clear', card: 'off' }, 'mesh-glow': { card: 'on' } })
  engine(on, w)
  await $.session.start(start)
  expect(w.store.get('settings')).toEqual({ 'pixel-room': { glass: 'clear' } })
})

test('/themes list names every theme with its author; /themes <name> switches from a timer', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  const list = (await themes($, 'list')).text ?? ''
  expect(list).toContain('pixel-room')
  expect(list).toContain('Pixel Room, by Samarth (installed)')
  expect(list).toContain('Honu Lagoon, by Anthropic (not installed)')

  expect((await themes($, 'Pixel Room')).text).toBe('Switching to Pixel Room, by Samarth.')
  await clock.advance(1)
  expect(w.runs).toEqual(['/pixel-room on'])
  expect(w.store.get('chosen')).toBe('pixel-room')

  expect((await themes($, 'honu-lagoon')).text).toContain('not installed')
  expect((await themes($, 'nope')).text).toBe('No theme named "nope". /themes list names them all.')

  expect((await themes($, 'off')).text).toBe('Turning the theme off.')
  await clock.advance(1)
  expect(w.runs).toEqual(['/pixel-room on', '/pixel-room off'])
  expect(w.store.has('chosen')).toBe(false)
})

test("an Anthropic scene is tried for this session, and Keep applies it with the scope chosen", async ($, on) => {
  const w = world(['pixel-room', 'theme-examples'])
  engine(on, w)
  await $.session.start(start)
  await themes($)
  const ui = await $.ui.mount(BAND('desktop', 400))
  await ui.press({ key: 'tile:pixel-room' })
  await ui.press({ key: 'tile:night-reef' })
  expect(w.runs).toEqual(['/pixel-room on', '/pixel-room off', '/custom-theme night-reef session'])
  // Keep for this project by default.
  await ui.press({ key: 'keep' })
  expect(w.runs.at(-1)).toBe('/custom-theme night-reef')
  expect(w.store.get('chosen')).toBe('night-reef')
  await ui.unmount()
})

test('a start with a kept theme runs no theme command, however long it waits', async ($, on) => {
  const w = world()
  w.store.set('chosen', 'pixel-room')
  const clock = engine(on, w)
  await $.session.start(start)
  await clock.advance(10_000)
  expect(w.runs).toEqual([])
  expect(w.store.get('chosen')).toBe('pixel-room')
})

test('only the kept theme draws: another catalog theme is held until it is turned on', async () => {
  const pixel = entryOf('pixel-room')
  const reef = entryOf('night-reef')
  const found = ['pixel-room', 'theme-examples']
  expect(isHeld('theme-examples', pixel, found, new Set())).toBe(true)
  expect(isHeld('pixel-room', reef, found, new Set())).toBe(true)
  expect(isHeld('pixel-room', pixel, found, new Set())).toBe(false)
  // Turned on by the person or the picker this session.
  expect(isHeld('theme-examples', pixel, found, new Set(['theme-examples']))).toBe(false)
  // Nothing kept, the kept theme not loaded, or a theme outside the catalog: nothing is held.
  expect(isHeld('theme-examples', undefined, found, new Set())).toBe(false)
  expect(isHeld('theme-examples', pixel, ['theme-examples'], new Set())).toBe(false)
  expect(isHeld('someone-else', pixel, found, new Set())).toBe(false)
})

test("a typed command that turns a theme on names its plugin; an option or off does not", async () => {
  expect(turnsOnBy('pixel-room', 'on')).toBe('pixel-room')
  expect(turnsOnBy('custom-theme', 'night-reef')).toBe('theme-examples')
  expect(turnsOnBy('custom-theme', 'night-reef session')).toBe('theme-examples')
  expect(turnsOnBy('pixel-room', 'off')).toBeUndefined()
  expect(turnsOnBy('pixel-room', 'glass clear')).toBeUndefined()
})
