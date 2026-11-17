import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

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

const world = (plugins: string[] = ['constellation', 'real-sky', 'pixel-room']): World => ({
  store: new Map(),
  plugins,
  runs: [],
  argv: [],
  exitCode: 0,
})

const COMMAND_OF: Record<string, string> = {
  constellation: 'constellation',
  'real-sky': 'real-sky',
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
  test(`${surface}: /themes opens a strip of every theme, each tagged with its author`, async ($, on) => {
    const w = world(['constellation', 'real-sky', 'pixel-room', 'theme-examples'])
    engine(on, w)
    await $.session.start(start)
    expect((await themes($)).text).toBe('Pick a theme in the band above the prompt.')

    // Wide enough for one page of all 23.
    const ui = await $.ui.mount(BAND(surface, 1000))
    for (const id of ['constellation', 'real-sky', 'pixel-room', 'honu-lagoon', 'ember']) {
      expect(await ui.find({ key: `tile:${id}` })).toBeDefined()
    }
    const words = (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join(' ')
    expect(words).toContain('Samarth')
    expect(words).toContain('Anthropic')
    // Opening runs nothing: no theme changes until a tile is picked.
    expect(w.runs).toEqual([])
    await ui.unmount()
  })

  test(`${surface}: picking tries a theme live, and the next pick turns the last one off first`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))

    await ui.press({ key: 'tile:constellation' })
    expect(w.runs).toEqual(['/constellation on'])
    await ui.press({ key: 'tile:real-sky' })
    expect(w.runs).toEqual(['/constellation on', '/constellation off', '/real-sky on'])
    // Picking the theme that is already on runs nothing.
    await ui.press({ key: 'tile:real-sky' })
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
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    let ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:constellation' })
    await ui.press({ key: 'keep' })
    await ui.unmount()

    await themes($)
    ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:pixel-room' })
    await ui.press({ key: 'cancel' })
    expect(w.runs).toEqual(['/constellation on', '/constellation off', '/pixel-room on', '/pixel-room off', '/constellation on'])
    expect(w.store.get('chosen')).toBe('constellation')
    expect(await ui.find({ key: 'cancel' })).toBeUndefined()
    await ui.unmount()
  })

  test(`${surface}: Cancel with nothing on before turns the tried theme off`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:real-sky' })
    await ui.press({ key: 'cancel' })
    expect(w.runs).toEqual(['/real-sky on', '/real-sky off'])
    expect(w.store.has('chosen')).toBe(false)
    await ui.unmount()
  })

  test(`${surface}: a theme's options drive its own command, and an action asks first`, async ($, on) => {
    const w = world()
    engine(on, w)
    await $.session.start(start)
    await themes($)
    const ui = await $.ui.mount(BAND(surface))
    await ui.press({ key: 'tile:real-sky' })
    await ui.select({ key: 'opt:real-sky:phase', value: 'dusk' })
    await ui.select({ key: 'opt:real-sky:almanac', value: 'off' })
    expect(w.runs).toEqual(['/real-sky on', '/real-sky dusk', '/real-sky almanac off'])
    expect(w.store.get('settings')).toEqual({ 'real-sky': { phase: 'dusk', almanac: 'off' } })

    await ui.press({ key: 'tile:constellation' })
    await ui.press({ key: 'act:constellation:reset' })
    expect(w.runs.at(-1)).toBe('/constellation on')
    await ui.press({ key: 'confirm' })
    expect(w.runs.at(-1)).toBe('/constellation reset')
    await ui.unmount()
  })

  test(`${surface}: Install runs claude plugin install, and asks for /reload-plugins`, async ($, on) => {
    const w = world(['constellation'])
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
    expect(w.argv.map(argv => argv[3])).toEqual(['constellation@samarth', 'real-sky@samarth', 'pixel-room@samarth'])
    expect(await ui.find({ type: 'Text', text: /claude plugin install constellation@samarth/ })).toBeDefined()
    await ui.unmount()
  })
}

test('a narrow band pages its tiles, and the arrows move through them', async ($, on) => {
  const w = world(['constellation', 'real-sky', 'pixel-room', 'theme-examples'])
  engine(on, w)
  await $.session.start(start)
  await themes($)

  const wide = await $.ui.mount(BAND('desktop', 400))
  expect(await wide.findAll({ type: 'Svg' })).toHaveLength(23)
  expect(await wide.find({ key: 'next' })).toBeUndefined()
  await wide.unmount()

  const narrow = await $.ui.mount(BAND('desktop', 50))
  expect(await narrow.findAll({ type: 'Svg' })).toHaveLength(3)
  expect(await narrow.find({ key: 'tile:constellation' })).toBeDefined()
  await narrow.press({ key: 'next' })
  expect(await narrow.find({ key: 'tile:constellation' })).toBeUndefined()
  expect(await narrow.find({ key: 'tile:honu-lagoon' })).toBeDefined()
  await narrow.unmount()

  const terminal = await $.ui.mount(BAND('terminal', 60))
  expect(await terminal.find({ key: 'next' })).toBeDefined()
  expect((await terminal.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('tile:')).length).toBeLessThan(23)
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

  const short = await $.ui.mount(BAND('terminal', 60, 1))
  expect(await short.find({ key: 'tile:constellation' })).toBeDefined()
  expect(await short.find({ key: 'cancel' })).toBeUndefined()
  await short.unmount()
})

test('/themes list names every theme with its author; /themes <name> switches from a timer', async ($, on) => {
  const w = world()
  const clock = engine(on, w)
  await $.session.start(start)
  const list = (await themes($, 'list')).text ?? ''
  expect(list).toContain('constellation')
  expect(list).toContain('Real Sky, by Samarth (installed)')
  expect(list).toContain('Honu Lagoon, by Anthropic (not installed)')

  expect((await themes($, 'Real Sky')).text).toBe('Switching to Real Sky, by Samarth.')
  await clock.advance(1)
  expect(w.runs).toEqual(['/real-sky on'])
  expect(w.store.get('chosen')).toBe('real-sky')

  expect((await themes($, 'honu-lagoon')).text).toContain('not installed')
  expect((await themes($, 'nope')).text).toBe('No theme named "nope". /themes list names them all.')

  expect((await themes($, 'off')).text).toBe('Turning the theme off.')
  await clock.advance(1)
  expect(w.runs).toEqual(['/real-sky on', '/real-sky off'])
  expect(w.store.has('chosen')).toBe(false)
})

test("an Anthropic scene is tried for this session, and Keep applies it with the scope chosen", async ($, on) => {
  const w = world(['constellation', 'theme-examples'])
  engine(on, w)
  await $.session.start(start)
  await themes($)
  const ui = await $.ui.mount(BAND('desktop', 400))
  await ui.press({ key: 'tile:constellation' })
  await ui.press({ key: 'tile:night-reef' })
  expect(w.runs).toEqual(['/constellation on', '/constellation off', '/custom-theme night-reef session'])
  // Keep for this project by default.
  await ui.press({ key: 'keep' })
  expect(w.runs.at(-1)).toBe('/custom-theme night-reef')
  expect(w.store.get('chosen')).toBe('night-reef')
  await ui.unmount()
})
