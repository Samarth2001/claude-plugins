import type { EngineInterface, Register, ThemeResult, Timer } from 'claude-code'

import { COLORS, GLASS_WORDS, glassFor } from './look'
import type { Glass } from './look'
import { STILL_ALT, stillSvg } from './still'

const PLUGIN = 'silk'
const TITLE = 'Silk'
const SCENE = 'silk'
/** How often the backdrop checks the hour between turns. */
const TICK_MS = 10 * 60_000
/** Counters wrap inside the shader's declared range of 0 to 1023. */
const WRAP = 1024
const HELP = 'Try /silk, or on, off, glass clear|soft|frosted, or forget.'

// The module's own state: a reload starts it over and session.start runs again.
let isOn = true
let glass: Glass = 'soft'
let lastSet: ThemeResult | undefined
let tick: Timer | undefined
// The local hour, to a tenth: the shader turns it into night and warmth.
let hour = 12
// Claude's state for the shader, which eases each change itself.
let work = 0
let calls = 0
let errs = 0
let turns = 0
let sends = 0

/** One line to the debug log: a fault in this mod never reaches the session. */
function tell($: EngineInterface, step: string, error: unknown): void {
  try {
    $.ui.log(`${step} failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } catch {
    // Nowhere left to tell it.
  }
}

/** Reads the clock for the hour. True when it changed. */
async function readHour($: EngineInterface): Promise<boolean> {
  const at = new Date(await $.clock.now())
  const next = Math.round((at.getHours() + at.getMinutes() / 60) * 10) / 10
  const isChanged = next !== hour
  hour = next
  return isChanged
}

const isNight = (at: number): boolean => at >= 19 || at < 6

async function setTheme($: EngineInterface): Promise<void> {
  lastSet = await $.theme.set({
    colors: COLORS,
    backdrop: { scene: SCENE, glass: glassFor(glass) },
    overrideColorScheme: 'dark',
  })
}

/** Draws the backdrop again with the values as they stand, where it is on. */
function redraw($: EngineInterface): void {
  if (isOn) $.ui.invalidate('ui.render')
}

async function command($: EngineInterface, args: string): Promise<string> {
  const word = args.trim().toLowerCase().replace(/\s+/g, ' ')
  if (word === '') {
    let first = `${TITLE} is on.`
    if (!isOn) first = `${TITLE} is off. /silk on brings it back.`
    else if (lastSet?.isDrawn === true) first = `${TITLE} is on, drawn behind this window.`
    else if (lastSet?.isDrawn === false) first = `${TITLE} is on, but this window doesn't draw backdrops: it shows in the Claude desktop app.`
    return `${first}\nThe glass is ${glass}.`
  }
  if (word === 'on') {
    isOn = true
    await $.store.delete('enabled')
    await setTheme($)
    return `${TITLE} is on.`
  }
  if (word === 'off') {
    isOn = false
    await $.store.set('enabled', false)
    await $.theme.clear()
    return `${TITLE} is off. /silk on brings it back.`
  }
  if (word === 'glass' || word.startsWith('glass ')) {
    const next = word.slice(6) as Glass
    if (!GLASS_WORDS.includes(next)) return `The glass is ${glass}. Try /silk glass clear, soft or frosted.`
    glass = next
    if (glass === 'soft') await $.store.delete('glass')
    else await $.store.set('glass', glass)
    if (isOn) await setTheme($)
    return `The glass is ${glass}.`
  }
  if (word === 'forget') {
    // Before a removal: every choice it kept goes. The theme is cleared only if it is this one's.
    const wasOn = isOn
    isOn = false
    glass = 'soft'
    for (const key of await $.store.keys()) await $.store.delete(key)
    if (wasOn) await $.theme.clear()
    return `${TITLE} forgot what it kept and is off until it loads again.`
  }
  return HELP
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      // The name is written out here and on `command.run`, so the engine reads the command as this mod's own.
      await $.command.register({
        name: 'silk',
        description:
          'Graphite satin behind the desktop app: how it stands, or "on", "off", "glass clear|soft|frosted", or "forget" to delete what it kept',
        argumentHint: '[on | off | glass clear|soft|frosted | forget]',
      })
    } catch (error) {
      // A refused command costs the backdrop nothing.
      tell($, '/silk', error)
    }
    try {
      isOn = (await $.store.get('enabled')) !== false
      const kept = await $.store.get('glass')
      glass = GLASS_WORDS.includes(kept as Glass) ? (kept as Glass) : 'soft'
      await readHour($)
      if (isOn) await setTheme($)
    } catch (error) {
      tell($, 'session.start', error)
    }
    try {
      // One timer at a time, should the session start again.
      tick?.cancel()
      tick = $.clock.every(TICK_MS, () => {
        readHour($)
          .then(isChanged => {
            if (isChanged) redraw($)
          })
          .catch(error => tell($, 'the clock', error))
      })
    } catch (error) {
      tell($, 'the clock', error)
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

  // The main loop starts work: the folds drift faster and the sheen lifts.
  on('turn.start', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    try {
      work = 1
      sends = (sends + 1) % WRAP
      redraw($)
    } catch (error) {
      tell($, 'turn.start', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // Each of the main loop's tool calls sends a wave through the cloth; an error warms the sheen.
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    try {
      if (e.agentId === undefined && out.deny === undefined) {
        calls = (calls + 1) % WRAP
        if (out.isError === true) errs = (errs + 1) % WRAP
        redraw($)
      }
    } catch (error) {
      tell($, 'tool.call', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // The main loop's turn ends: the folds slow, and a band of light crosses them.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    try {
      work = 0
      if (!e.isAborted) turns = (turns + 1) % WRAP
      redraw($)
    } catch (error) {
      tell($, 'turn.complete', error)
    }
    return out
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    if (e.props.scene !== SCENE) return next(e)
    const { Shader, Svg } = $.ui.resolve(e)
    // A Claude Code from before shaders (2.1.326) has no `Shader` in its table, and would
    // refuse a tree that holds one, so there the still picture draws alone.
    if (Shader === undefined) return <Svg source={stillSvg(isNight(hour))} alt={STILL_ALT} />
    return (
      <Shader module="./shader.ts" values={{ work, calls, errs, turns, sends, hour }}>
        <Svg source={stillSvg(isNight(hour))} alt={STILL_ALT} />
      </Shader>
    )
  })

  on('command.run', { command: 'silk' }, async ($, e) => {
    try {
      return { text: await command($, e.args) }
    } catch (error) {
      tell($, '/silk', error)
      return { text: `${TITLE} could not do that: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
