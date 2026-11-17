import type { EngineInterface, Register, ThemeResult } from 'claude-code'

import { COLORS, GLASS_WORDS, glassFor } from './look'
import type { Glass } from './look'
import { buildScene } from './scene'
import { REVEAL_MS, emptyDelta, emptySky, isEmptyDelta, isTestCommand, layout, mergeDelta, parseSky, relativePath, summary } from './sky'
import type { Delta, Sky } from './sky'

const PLUGIN = 'constellation'
const SCENES = ['sky-a', 'sky-b'] as const
const HINT = 'Constellation: files Claude edits become stars. Your sky fills in as you work.'
const UNDRAWN = "This window doesn't draw backdrops; the sky still records and shows in the desktop app."

// The module's own state: a reload starts it over and session.start runs again.
let root: string | undefined
let sky: Sky = emptySky()
let delta: Delta = emptyDelta()
// The scene shows a meteor while the clock reads before this.
let meteorUntil = 0
// Each update draws under the other scene name, which is what makes the app draw the backdrop afresh.
let flip = 0
let isOn = true
let glass: Glass = 'soft'
let lastSet: ThemeResult | undefined
// The last scene built, for a second window or a resize that asks again for the same sky.
let built: { flip: number; sky: Sky; at: number; source: string; isRest: boolean } | undefined

const skyKey = () => `sky:${root ?? ''}`

function projectName(): string {
  const parts = (root ?? '').split(/[\\/]/).filter(part => part !== '')
  return parts.at(-1) ?? 'project'
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`

/** One line to the debug log: a fault in this mod never reaches the session. */
function tell($: EngineInterface, step: string, error: unknown): void {
  try {
    $.ui.log(`${step} failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } catch {
    // Nowhere left to tell it.
  }
}

async function setTheme($: EngineInterface): Promise<ThemeResult> {
  lastSet = await $.theme.set({
    colors: COLORS,
    backdrop: { scene: SCENES[flip % 2] ?? 'sky-a', glass: glassFor(glass) },
    overrideColorScheme: 'dark',
  })
  return lastSet
}

/** One argument of a tool call, as given. */
function argument(input: object, name: string): unknown {
  return (input as Record<string, unknown>)[name]
}

/** One argument of a tool call, where it is a string. */
function field(input: object, name: string): string | undefined {
  const value = argument(input, name)
  return typeof value === 'string' ? value : undefined
}

function count(into: Record<string, number>, file: string | undefined): void {
  if (root === undefined || file === undefined) return
  const path = relativePath(root, file)
  if (path !== undefined) into[path] = (into[path] ?? 0) + 1
}

/** Whether anything in the sky is still playing in at `now`: a star, a line or a meteor. */
function isSettled(at: number): boolean {
  if (at < meteorUntil) return false
  const recent = (time: number) => at - time < REVEAL_MS
  return (
    !Object.values(sky.stars).some(star => recent(star.born) || recent(star.touched)) &&
    !sky.constellations.some(figure => recent(figure.at))
  )
}

function scene(now: number): string {
  if (built !== undefined && built.flip === flip && built.sky === sky && (built.isRest || now - built.at < REVEAL_MS)) {
    return built.source
  }
  const source = buildScene({
    placed: layout(sky),
    constellations: sky.constellations,
    now,
    meteor: now < meteorUntil,
    projectName: projectName(),
  })
  built = { flip, sky, at: now, source, isRest: isSettled(now) }
  return source
}

function alt(): string {
  const stars = Object.keys(sky.stars).length
  if (stars === 0) return 'A night sky with no stars of this project yet'
  return `A night sky with ${plural(stars, 'star')} in ${plural(sky.constellations.length, 'constellation')}, one star for each file Claude worked on in this project`
}

async function command($: EngineInterface, args: string): Promise<string> {
  const word = args.trim().toLowerCase()
  if (word === '') {
    const lines = [summary(sky, projectName())]
    if (!isOn) lines.push('Constellation is off; /constellation on brings it back.')
    else if (lastSet?.isDrawn === false) lines.push(UNDRAWN)
    return lines.join('\n')
  }
  if (word === 'off') {
    isOn = false
    await $.store.set('enabled', false)
    await $.theme.clear()
    return 'Constellation is off. Your sky is kept; /constellation on brings it back.'
  }
  if (word === 'on') {
    isOn = true
    await $.store.delete('enabled')
    flip += 1
    await setTheme($)
    return 'Constellation is on.'
  }
  if (word === 'glass' || word.startsWith('glass ')) {
    const next = word.slice(6).trim() as Glass
    if (!GLASS_WORDS.includes(next)) return `The glass is ${glass}. Try /constellation glass clear, soft or frosted.`
    glass = next
    if (glass === 'soft') await $.store.delete('glass')
    else await $.store.set('glass', glass)
    flip += 1
    if (isOn) await setTheme($)
    return `The glass is ${glass}.`
  }
  if (word === 'reset') {
    await $.store.delete(skyKey())
    sky = emptySky()
    delta = emptyDelta()
    meteorUntil = 0
    flip += 1
    if (isOn) await setTheme($)
    return "This project's sky is cleared."
  }
  if (word === 'forget') {
    // Before a removal: everything kept goes, every project's sky included. The theme is cleared only if it is this one's.
    const wasOn = isOn
    isOn = false
    glass = 'soft'
    for (const key of await $.store.keys()) await $.store.delete(key)
    sky = emptySky()
    delta = emptyDelta()
    meteorUntil = 0
    if (wasOn) await $.theme.clear()
    return 'Constellation forgot every sky it kept and is off until it loads again.'
  }
  return 'Try /constellation, /constellation off, /constellation on, /constellation reset, /constellation glass clear|soft|frosted or /constellation forget.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'constellation',
        description: 'Your project\'s night sky: a summary, or "off", "on", "reset", "glass clear|soft|frosted", or "forget" to delete every sky it kept',
        argumentHint: '[off | on | reset | glass clear|soft|frosted | forget]',
      })
    } catch (error) {
      // A refused command costs the sky nothing.
      tell($, '/constellation', error)
    }
    try {
      root = await $.session.root()
      isOn = (await $.store.get('enabled')) !== false
      const kept = await $.store.get('glass')
      glass = GLASS_WORDS.includes(kept as Glass) ? (kept as Glass) : 'soft'
      sky = parseSky(await $.store.get(skyKey()))
      if (isOn) {
        const set = await setTheme($)
        if (set.isDrawn && (await $.store.get('hinted')) !== true && Object.keys(sky.stars).length === 0) {
          $.ui.toast(HINT)
          await $.store.set('hinted', true)
        }
      }
    } catch (error) {
      tell($, 'session.start', error)
    }
    return next(e)
  })

  // A clear, a resume or a fork drops the theme, which is display only: set it again.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    try {
      if (isOn) await setTheme($)
    } catch (error) {
      tell($, 'SessionStart', error)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Every tool call, a subagent's included: the engine's answer first, then a note of what it touched.
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    try {
      if (out.deny !== undefined || out.isError === true) return out
      const tool = String(e.tool)
      if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') count(delta.edits, field(e, 'file_path'))
      else if (tool === 'NotebookEdit') count(delta.edits, field(e, 'notebook_path'))
      else if (tool === 'Read') count(delta.reads, field(e, 'file_path'))
      else if (tool === 'Bash' || tool === 'PowerShell') {
        // A command sent to the background has not passed anything yet.
        const line = field(e, 'command')
        if (line !== undefined && argument(e, 'run_in_background') !== true && isTestCommand(line)) delta.testsPassed = true
      }
    } catch (error) {
      tell($, 'tool.call', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // The main loop's turn ends: what it and its subagents touched lands in the sky.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined || isEmptyDelta(delta)) return out
    // Taken before any wait, so the next turn's calls start a fresh delta.
    const taken = delta
    delta = emptyDelta()
    try {
      const now = await $.clock.now()
      // Read afresh, so another session's stars in this project are kept.
      let base = sky
      try {
        base = parseSky(await $.store.get(skyKey()))
      } catch (error) {
        tell($, 'reading the sky', error)
      }
      sky = mergeDelta(base, taken, now)
      if (taken.testsPassed) meteorUntil = now + REVEAL_MS
      try {
        await $.store.set(skyKey(), sky)
      } catch (error) {
        tell($, 'keeping the sky', error)
      }
      if (isOn) {
        flip += 1
        await setTheme($)
      }
    } catch (error) {
      tell($, 'turn.complete', error)
    }
    return out
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    if (!(SCENES as readonly string[]).includes(e.props.scene)) return next(e)
    const { Svg } = $.ui.resolve(e)
    const source = scene(await $.clock.now())
    return <Svg isInteractive source={source} alt={alt()} />
  })

  on('command.run', { command: 'constellation' }, async ($, e) => {
    try {
      return { text: await command($, e.args) }
    } catch (error) {
      tell($, '/constellation', error)
      return { text: `Constellation could not do that: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
