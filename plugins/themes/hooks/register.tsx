import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { drawBand } from './band'
import type { Actions, View } from './band'
import { CATALOG, PLUGINS, entriesOf, entryOf } from './catalog'
import type { Entry } from './catalog'
import { COMMANDS, activeOf, isHeld, keepRuns, offs, switchRuns, tilesOf, turnsOnBy } from './plan'
import type { Run } from './plan'
import type { Band, ThemeSettings } from '../types'

const PLUGIN = 'themes'
const HELD = 'Held back by the themes picker: another theme is kept.'
const CLI_TIMEOUT_MS = 180_000

const CLOSED: Band = { isOpen: false, page: -1, picked: null, before: null, confirm: null, isBusy: false, note: null }

const band = atom({ plugin: 'themes', key: 'band' } as const, CLOSED)
const active = atom({ plugin: 'themes', key: 'active' } as const, null as string | null)
const lit = atom({ plugin: 'themes', key: 'lit' } as const, [] as string[])
const installed = atom({ plugin: 'themes', key: 'installed' } as const, [] as string[])
const pending = atom({ plugin: 'themes', key: 'pending' } as const, [] as string[])
const settings = atom({ plugin: 'themes', key: 'settings' } as const, {} as ThemeSettings)

// The module's own: what a theme's command printed when the picker ran it (kept out of the transcript),
// the chain that runs the picker's steps one at a time, and the themes turned on since the module loaded:
// the picker's own runs and the person's typed `on`. Any other catalog theme is held back while one is kept.
const said = new Map<string, string | undefined>()
let queue: Promise<void> = Promise.resolve()
const allowed = new Set<string>()

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
const keyOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const specOf = (entry: Entry) => `${entry.plugin}@${entry.marketplace}`

/** One line to the debug log: a fault in the picker never reaches the session. */
function tell($: EngineInterface, step: string, error: unknown): void {
  try {
    $.ui.log(`${step} failed: ${message(error)}`, { to: 'debug' })
  } catch {
    // Nowhere left to tell it.
  }
}

/** Finds a theme by id or by title, as `/themes <name>` takes it. */
function named(words: string): Entry | undefined {
  const key = keyOf(words)
  return CATALOG.find(entry => entry.id === key || keyOf(entry.title) === key)
}

/** Which catalog plugins this session lists a command of: installed and loaded. */
async function look($: EngineInterface): Promise<string[]> {
  try {
    const listed = await $.command.list()
    const found = PLUGINS.filter(plugin => {
      const command = entriesOf(plugin)[0]?.command
      return listed.some(c => c.source === 'plugin' && (c.plugin === plugin || c.name === command))
    })
    await update($, installed, () => found)
    return found
  } catch (error) {
    tell($, 'listing commands', error)
    return read($, installed)
  }
}

/** Runs the picker's steps one after another; each shows as busy, and a fault becomes the band's note. */
function enqueue($: EngineInterface, work: () => Promise<void>): Promise<void> {
  const step = queue.then(async () => {
    await update($, band, b => ({ ...b, isBusy: true }))
    try {
      await work()
    } catch (error) {
      tell($, 'a picker step', error)
      await update($, band, b => ({ ...b, note: `That did not work: ${message(error)}` }))
    } finally {
      await update($, band, b => ({ ...b, isBusy: false }))
    }
  })
  queue = step.catch(() => undefined)
  return step
}

/** Runs one theme command as the person typing it would, and answers what it printed. */
async function runOne($: EngineInterface, run: Run): Promise<string | undefined> {
  const key = `${run.command} ${run.args}`
  if (run.turnsOn !== undefined) allowed.add(run.plugin)
  said.delete(key)
  const out = await $.command.run({ command: run.command, args: run.args })
  const text = said.has(key) ? said.get(key) : out.text
  said.delete(key)
  // The theme's own set and clear tell the band too; this keeps it right where no window draws themes.
  if (run.isOff) {
    await update($, lit, plugins => plugins.filter(p => p !== run.plugin))
    await update($, active, id => (entryOf(id)?.plugin === run.plugin ? null : id))
  }
  const turnsOn = run.turnsOn
  if (turnsOn !== undefined) {
    await update($, lit, plugins => (plugins.includes(run.plugin) ? plugins : [...plugins, run.plugin]))
    await update($, active, () => turnsOn)
  }
  return text
}

async function runAll($: EngineInterface, runs: readonly Run[]): Promise<string | undefined> {
  let last: string | undefined
  for (const run of runs) last = await runOne($, run)
  return last
}

/** The runs that leave `id` on and applied as kept: off the others, try it, then any keep words. */
async function applyRuns($: EngineInterface, entry: Entry, isKeep: boolean): Promise<Run[]> {
  const switching = (await read($, active)) === entry.id ? [] : switchRuns(entry.id, await read($, lit), await read($, installed))
  return [...switching, ...(isKeep ? keepRuns(entry, await read($, settings)) : [])]
}

/** Runs `claude plugin <verb> <spec>` on this machine; on a fault, says why. */
async function cli($: EngineInterface, verb: 'install' | 'uninstall', spec: string): Promise<string | undefined> {
  try {
    const out = await $.process.run(['claude', 'plugin', verb, spec], { timeoutMs: CLI_TIMEOUT_MS })
    if (out.exitCode === 0) return undefined
    const lines = `${out.stderr}\n${out.stdout}`.split('\n').map(line => line.trim()).filter(line => line !== '')
    return lines.at(0) ?? `it exited with ${out.exitCode}`
  } catch (error) {
    return message(error)
  }
}

async function note($: EngineInterface, text: string | null): Promise<void> {
  await update($, band, b => ({ ...b, note: text }))
}

async function open($: EngineInterface): Promise<void> {
  const found = await look($)
  const now = await read($, active)
  const first = tilesOf(found)[0]?.id ?? null
  await update($, band, () => ({ ...CLOSED, isOpen: true, picked: now ?? first, before: now }))
}

async function close($: EngineInterface): Promise<void> {
  await update($, band, () => CLOSED)
}

/** Tries a theme live: the others off, this one on. Nothing is kept until Keep. */
async function pick($: EngineInterface, id: string): Promise<void> {
  await update($, band, b => ({ ...b, picked: id, confirm: null, note: null }))
  const entry = entryOf(id)
  if (entry === undefined || !(await read($, installed)).includes(entry.plugin)) return
  if ((await read($, pending)).includes(entry.plugin)) return
  await enqueue($, async () => {
    await runAll($, await applyRuns($, entry, false))
  })
}

async function keep($: EngineInterface): Promise<void> {
  await enqueue($, async () => {
    const entry = entryOf((await read($, band)).picked)
    if (entry === undefined) return
    await runAll($, await applyRuns($, entry, true))
    await $.store.set('chosen', entry.id)
    await close($)
  })
}

/** Puts back what was on when the band opened, then closes it. */
async function cancel($: EngineInterface): Promise<void> {
  await enqueue($, async () => {
    const before = entryOf((await read($, band)).before)
    const now = await read($, active)
    if ((before?.id ?? null) !== now) {
      if (before === undefined) await runAll($, offs(await read($, lit), await read($, installed)))
      else await runAll($, await applyRuns($, before, true))
    }
    await close($)
  })
}

/** Records the option a typed theme command set, so the band shows what the theme now has. */
async function follow($: EngineInterface, command: string, args: string): Promise<void> {
  const words = args.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const entry of CATALOG.filter(en => en.command === command)) {
    if (entry.forget !== undefined && words === entry.forget) {
      // The theme forgot its settings, so the picker forgets what it showed for them.
      const next = await update($, settings, all => Object.fromEntries(Object.entries(all).filter(([id]) => id !== entry.id)))
      await $.store.set('settings', next)
      return
    }
    for (const option of entry.options) {
      if (option.kind !== 'choice' || option.isOnKeep === true) continue
      const choice = option.values.find(v => v.args === words)
      if (choice === undefined) continue
      const next = await update($, settings, (all): ThemeSettings => ({ ...all, [entry.id]: { ...all[entry.id], [option.name]: choice.value } }))
      await $.store.set('settings', next)
      return
    }
  }
}

async function choose($: EngineInterface, id: string, name: string, value: string): Promise<void> {
  const entry = entryOf(id)
  const option = entry?.options.find(o => o.name === name)
  if (entry === undefined || option?.kind !== 'choice') return
  const choice = option.values.find(v => v.value === value)
  if (choice === undefined) return
  const next = await update($, settings, (all): ThemeSettings => ({ ...all, [id]: { ...all[id], [name]: value } }))
  await $.store.set('settings', next).catch(error => tell($, 'keeping settings', error))
  if (option.isOnKeep === true || !(await read($, installed)).includes(entry.plugin)) return
  await enqueue($, async () => {
    await note($, (await runOne($, { command: entry.command, args: choice.args, plugin: entry.plugin, isOff: false })) ?? null)
  })
}

async function act($: EngineInterface, id: string, name: string): Promise<void> {
  const entry = entryOf(id) ?? entriesOf(id)[0]
  const option = entry?.options.find(o => o.name === name)
  if (name === 'remove' || (option?.kind === 'action' && option.confirm !== undefined)) {
    await update($, band, b => ({ ...b, confirm: { id, action: name }, note: null }))
    return
  }
  if (entry === undefined || option?.kind !== 'action') return
  await enqueue($, async () => {
    await note($, (await runOne($, { command: entry.command, args: option.args, plugin: entry.plugin, isOff: false })) ?? null)
  })
}

async function confirm($: EngineInterface): Promise<void> {
  const asked = (await read($, band)).confirm
  await update($, band, b => ({ ...b, confirm: null }))
  if (asked === null) return
  if (asked.action === 'remove') return remove($, asked.id)
  const entry = entryOf(asked.id)
  const option = entry?.options.find(o => o.name === asked.action)
  if (entry === undefined || option?.kind !== 'action') return
  await enqueue($, async () => {
    await note($, (await runOne($, { command: entry.command, args: option.args, plugin: entry.plugin, isOff: false })) ?? null)
  })
}

async function install($: EngineInterface, ids: readonly string[]): Promise<void> {
  await enqueue($, async () => {
    const failed: string[] = []
    let reason = ''
    for (const id of ids) {
      const entry = entryOf(id) ?? entriesOf(id)[0]
      if (entry === undefined) continue
      const fault = await cli($, 'install', specOf(entry))
      if (fault === undefined) await update($, pending, p => [...new Set([...p, entry.plugin])])
      else {
        failed.push(specOf(entry))
        reason = fault
      }
    }
    await note(
      $,
      failed.length === 0
        ? 'Installed. Run /reload-plugins to load it.'
        : `Could not install from here (${reason}). In a shell: ${failed.map(spec => `claude plugin install ${spec}`).join('; ')}`,
    )
  })
}

/** Turns the theme off, deletes what it stored where it can, then uninstalls its plugin. */
async function remove($: EngineInterface, id: string): Promise<void> {
  await enqueue($, async () => {
    const entry = entryOf(id) ?? entriesOf(id)[0]
    if (entry === undefined) return
    const runs = offs(await read($, lit), await read($, installed)).filter(run => run.plugin === entry.plugin)
    if (entry.forget !== undefined) runs.push({ command: entry.command, args: entry.forget, plugin: entry.plugin, isOff: true })
    await runAll($, runs)
    // Cancel has nothing of it to put back once it is gone.
    await update($, band, b => (entryOf(b.before)?.plugin === entry.plugin ? { ...b, before: null } : b))
    if (entryOf((await $.store.get('chosen')) as string | undefined)?.plugin === entry.plugin) await $.store.delete('chosen')
    const kept = await update($, settings, all => Object.fromEntries(Object.entries(all).filter(([key]) => entryOf(key)?.plugin !== entry.plugin)))
    await $.store.set('settings', kept)
    const fault = await cli($, 'uninstall', specOf(entry))
    if (fault === undefined) await update($, pending, p => [...new Set([...p, entry.plugin])])
    await note(
      $,
      fault === undefined
        ? `Removed ${entry.plugin}. Run /reload-plugins to finish.`
        : `Turned off and cleared, but could not uninstall from here (${fault}). In a shell: claude plugin uninstall ${specOf(entry)}`,
    )
  })
}

/** Whether a theme set or cleared by `plugin` stays out: it would cover the kept theme at a start, unasked. */
async function held($: EngineInterface, plugin: string): Promise<boolean> {
  if (!PLUGINS.includes(plugin) || allowed.has(plugin)) return false
  const chosen = entryOf((await $.store.get('chosen')) as string | undefined)
  if (chosen === undefined || chosen.plugin === plugin) return false
  return isHeld(plugin, chosen, await look($), allowed)
}

function listText(found: readonly string[], now: string | null): string {
  const width = Math.max(...CATALOG.map(entry => entry.id.length))
  const lines = CATALOG.map(entry => {
    const state = entry.id === now ? 'on' : found.includes(entry.plugin) ? 'installed' : 'not installed'
    return `  ${entry.id.padEnd(width)}  ${entry.title}, by ${entry.author} (${state})`
  })
  return ['Themes:', ...lines, 'Open the picker with /themes; apply one with /themes <id>; /themes off turns the theme off.'].join('\n')
}

async function command($: EngineInterface, args: string): Promise<string> {
  const words = args.trim()
  if (words === '') {
    await open($)
    return 'Pick a theme in the band above the prompt.'
  }
  const lower = words.toLowerCase()
  if (lower === 'list') return listText(await look($), await read($, active))
  if (lower === 'off') {
    // The theme commands queue behind this one, so they run from a timer once it has answered.
    $.clock.after(0, () => {
      enqueue($, async () => {
        await runAll($, offs(await read($, lit), await look($)))
        await $.store.delete('chosen')
      }).catch(error => tell($, '/themes off', error))
    })
    return 'Turning the theme off.'
  }
  const entry = named(words)
  if (entry === undefined) return `No theme named "${words}". /themes list names them all.`
  if (!(await look($)).includes(entry.plugin)) {
    return `${entry.title} is not installed. Install it from the picker (/themes), or in a shell: claude plugin install ${specOf(entry)}`
  }
  $.clock.after(0, () => {
    enqueue($, async () => {
      await runAll($, await applyRuns($, entry, true))
      await $.store.set('chosen', entry.id)
    }).catch(error => tell($, '/themes', error))
  })
  return `Switching to ${entry.title}, by ${entry.author}.`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: PLUGIN,
        description: 'Pick a theme: thumbnails above the prompt to try live and keep; or a theme\'s id, "list" or "off"',
        argumentHint: '[<theme> | list | off]',
      })
    } catch (error) {
      tell($, '/themes', error)
    }
    try {
      const stored = await $.store.get('settings')
      if (stored !== null && typeof stored === 'object') await update($, settings, () => stored as ThemeSettings)
    } catch (error) {
      tell($, 'reading settings', error)
    }
    return next(e)
  })

  // Who set the session's theme: the band marks it, and switching turns it off before the next goes on.
  // A catalog theme nobody turned on this session, set while another is kept, is held back: nothing draws
  // it and nothing runs, so a start shows the kept theme alone.
  on('theme.set', async ($, e, next) => {
    if (await held($, next.origin.plugin)) return { value: { isDrawn: false, reason: HELD } }
    const out = await next(e)
    try {
      const plugin = next.origin.plugin
      const backdrop = e.backdrop
      const scene = typeof backdrop === 'object' && backdrop !== null && 'scene' in backdrop ? backdrop.scene : undefined
      if (PLUGINS.includes(plugin)) await update($, lit, plugins => (plugins.includes(plugin) ? plugins : [...plugins, plugin]))
      await update($, active, () => activeOf(plugin, scene))
    } catch (error) {
      tell($, 'theme.set', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  on('theme.clear', async ($, e, next) => {
    // A held theme's clear would take the kept theme down with it.
    if (await held($, next.origin.plugin)) return { value: { isDrawn: false, reason: HELD } }
    const out = await next(e)
    try {
      await update($, active, () => null)
    } catch (error) {
      tell($, 'theme.clear', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // A theme command the picker ran prints nothing in the transcript; the band says what came of it.
  on('command.run', async ($, e, next) => {
    const origin = e.origin as typeof e.origin | undefined
    if (origin?.kind !== 'plugin' || origin.name !== PLUGIN) {
      // A theme the person turns on is theirs to see, kept theme or not.
      const plugin = turnsOnBy(e.command, e.args)
      if (plugin !== undefined) allowed.add(plugin)
    }
    const out = await next(e)
    if (!COMMANDS.includes(e.command)) return out
    if (origin?.kind !== 'plugin' || origin.name !== PLUGIN) {
      // Typed by the person: an option it sets shows in the band as set, and a typed `on` is let through.
      try {
        await follow($, e.command, e.args)
      } catch (error) {
        tell($, 'following a command', error)
      }
      return out
    }
    said.set(`${e.command} ${e.args}`, out.text)
    const { ref: _ref, text: _text, ...rest } = out
    return rest
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const b = await read($, band)
    if (!b.isOpen || e.props.hasSurvey || e.props.maxRows < 1) return next(e)
    const ui = $.ui.resolve(e)
    if (e.props.isCollapsed) {
      const { Text } = ui
      return <Text dimColor>Themes</Text>
    }
    return drawBand(ui, await viewOf($, b), actionsOf($), { columns: e.props.bodyColumns, maxRows: e.props.maxRows, surface: e.surface })
  })

  on('command.run', { command: PLUGIN }, async ($, e) => {
    try {
      return { text: await command($, e.args) }
    } catch (error) {
      tell($, '/themes', error)
      return { text: `The picker could not do that: ${message(error)}` }
    }
  })
}

async function viewOf($: EngineInterface, b: Band): Promise<View> {
  const found = await read($, installed)
  return {
    band: b,
    active: await read($, active),
    tiles: tilesOf(found),
    pending: await read($, pending),
    settings: await read($, settings),
    canInstallOurs: !CATALOG.some(entry => entry.author === 'Samarth' && found.includes(entry.plugin)),
  }
}

function actionsOf($: EngineInterface): Actions {
  return {
    pick: id => void pick($, id),
    page: index => void update($, band, x => ({ ...x, page: index })),
    keep: () => void keep($),
    cancel: () => void cancel($),
    choose: (id, name, value) => void choose($, id, name, value),
    act: (id, name) => void act($, id, name),
    confirm: () => void confirm($),
    back: () => void update($, band, x => ({ ...x, confirm: null })),
    install: id => void install($, [id]),
    installOurs: () =>
      void install(
        $,
        CATALOG.filter(entry => entry.author === 'Samarth').map(entry => entry.id),
      ),
  }
}
