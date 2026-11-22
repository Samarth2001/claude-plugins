import type { EngineInterface, Register, ThemeResult, Timer } from 'claude-code'

import { COLORS, GLASS_WORDS, glassFor } from './look'
import type { Glass } from './look'
import { STILL_ALT, stillSvg } from './still'

// Also the command and the scene. The command is spelled out where it is registered and answered,
// since the validator reads it there only as a literal.
const PLUGIN = 'light-leak'
const TITLE = 'Light Leak'
const SCENE = 'light-leak'
/** How often the backdrop checks the clock between turns. */
const TICK_MS = 10 * 60_000
/** The counters' top: the shader's values run 0 to 1023, rounded to whole steps. */
const TOP = 1023
const HELP = 'Try /light-leak, or on, off, glass clear|soft|frosted, or forget.'

// The module's own state: a reload starts it over and session.start runs again.
let isOn = true
let glass: Glass = 'soft'
let lastSet: ThemeResult | undefined
let tick: Timer | undefined
// Whose theme stands now, as the theme events seen since the module loaded say: a plugin's name, or
// null for none. One theme stands at a time, so this plugin clears only its own and yields to another's.
let standing: string | null = null
// The local hour, for the still picture's day or night; night and warmth, for the shader.
let hour = 12
let night = 0
let warm = 0
// What happened, counted: whether a turn runs, tool calls, errors, finished turns and messages sent.
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

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const smooth = (from: number, to: number, x: number): number => {
  const k = clamp01((x - from) / (to - from))
  return k * k * (3 - 2 * k)
}
const round2 = (x: number): number => Math.round(x * 100) / 100

/**
 * A count as the shader reads it: up to the top, then back down, a step at a time. The shader sees each
 * change as one event, and the app eases a value it is sent, so a count that wrapped from the top to 0
 * would pass through every number between and read as a burst.
 */
export function bounce(count: number): number {
  const at = count % (2 * TOP)
  return at <= TOP ? at : 2 * TOP - at
}

/** Night and warmth at a local hour: whole night from 21:00 to 04:00, warm around 06:00 and 18:30. Both are smooth across midnight. */
export function skyAt(at: number): { night: number; warm: number } {
  const peak = (centre: number) => Math.exp(-(((at - centre) / 1.2) ** 2))
  return { night: round2(clamp01(smooth(17, 21, at) + 1 - smooth(4, 7, at))), warm: round2(clamp01(peak(6) + peak(18.5))) }
}

/** Reads the clock for the hour, night and warmth. True when any of them changed. */
async function readClock($: EngineInterface): Promise<boolean> {
  const at = new Date(await $.clock.now())
  const next = Math.round((at.getHours() + at.getMinutes() / 60) * 10) / 10
  const sky = skyAt(next)
  const isChanged = next !== hour || sky.night !== night || sky.warm !== warm
  hour = next
  night = sky.night
  warm = sky.warm
  return isChanged
}

const isNight = (at: number): boolean => at >= 19 || at < 6
const isStanding = (): boolean => standing === PLUGIN

/**
 * Whose theme stands after `by` set one and the engine answered `result`. A set stands when a window
 * draws it or it waits for one (it has a request id); a set denied, or held back before it reached the
 * session, has neither and leaves whoever stood.
 */
export function standsAfter(was: string | null, by: string, result: ThemeResult | undefined): string | null {
  return result !== undefined && (result.isDrawn || result.requestId !== undefined) ? by : was
}

/** Whether the start leaves the theme to another: never asked for by name (`enabled` unset) while another's stands. */
export function yieldsAtStart(enabled: unknown, standingNow: string | null): boolean {
  return enabled === undefined && standingNow !== null && standingNow !== PLUGIN
}

/** How it stands: off, drawn, not drawn here and why, or another theme in its place. */
export function statusOf(view: { isOn: boolean; standing: string | null; lastSet: ThemeResult | undefined }): string {
  const { isOn: on, standing: by, lastSet: set } = view
  if (!on) return `${TITLE} is off. /light-leak on brings it back.`
  if (by === PLUGIN) {
    if (set === undefined || set.isDrawn) return `${TITLE} is on, drawn behind this window.`
    return `${TITLE} is on, but nothing draws it here: ${set.reason}. It shows in the Claude desktop app.`
  }
  // A set that never stood, held back before it reached the session: its reason says by what.
  if (set !== undefined && !set.isDrawn && set.requestId === undefined) return `${TITLE} is on, but it isn't drawn: ${set.reason}.`
  if (by === null) return `${TITLE} is on, but no theme is showing. /light-leak on brings it back.`
  return `${TITLE} is on, but another theme is showing. /light-leak on brings it back.`
}

async function setTheme($: EngineInterface): Promise<void> {
  lastSet = await $.theme.set({
    colors: COLORS,
    backdrop: { scene: SCENE, glass: glassFor(glass) },
    overrideColorScheme: 'dark',
  })
}

/** Hands the shader the values as they stand; it eases to them itself. */
function redraw($: EngineInterface): void {
  if (isOn && isStanding()) $.ui.invalidate('ui.render')
}

async function command($: EngineInterface, args: string): Promise<string> {
  const word = args.trim().toLowerCase().replace(/\s+/g, ' ')
  if (word === '') return `${statusOf({ isOn, standing, lastSet })}\nThe glass is ${glass}.`
  if (word === 'on') {
    // Asked for by name: kept on, so it takes its place at a start even beside another theme.
    isOn = true
    await $.store.set('enabled', true)
    await setTheme($)
    return `${TITLE} is on.`
  }
  if (word === 'off') {
    isOn = false
    await $.store.set('enabled', false)
    // There is one theme: clear it only while it is this one's.
    if (isStanding()) await $.theme.clear()
    return `${TITLE} is off. /light-leak on brings it back.`
  }
  if (word === 'glass' || word.startsWith('glass ')) {
    const next = word.slice(6) as Glass
    if (!GLASS_WORDS.includes(next)) return `The glass is ${glass}. Try /light-leak glass clear, soft or frosted.`
    glass = next
    if (glass === 'soft') await $.store.delete('glass')
    else await $.store.set('glass', glass)
    // Set again only while this theme stands: a glass is no reason to cover another theme.
    if (isOn && isStanding()) await setTheme($)
    return `The glass is ${glass}.`
  }
  if (word === 'forget') {
    // Before a removal: every choice it kept goes, and the theme with it if it is this one's.
    isOn = false
    glass = 'soft'
    for (const key of await $.store.keys()) await $.store.delete(key)
    if (isStanding()) await $.theme.clear()
    return `${TITLE} forgot what it kept and is off until it loads again.`
  }
  return HELP
}

export const register: Register = on => {
  // Every theme set and clear, this plugin's and every other's, to know whose theme stands.
  on('theme.set', async ($, e, next) => {
    const out = await next(e)
    try {
      standing = standsAfter(standing, next.origin.plugin, out.value)
    } catch (error) {
      tell($, 'theme.set', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  on('theme.clear', async ($, e, next) => {
    const out = await next(e)
    standing = null
    return out
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'light-leak',
        description:
          'The light leak behind the window: how it stands, or "on", "off", "glass clear|soft|frosted", or "forget" to delete what it kept',
        argumentHint: '[on | off | glass clear|soft|frosted | forget]',
      })
    } catch (error) {
      // A refused command costs the backdrop nothing.
      tell($, '/light-leak', error)
    }
    try {
      const enabled = await $.store.get('enabled')
      isOn = enabled !== false
      const kept = await $.store.get('glass')
      glass = GLASS_WORDS.includes(kept as Glass) ? (kept as Glass) : 'soft'
      await readClock($)
      // Never asked for by name, it yields to a theme already showing, so installing several shows one.
      if (isOn && !yieldsAtStart(enabled, standing)) await setTheme($)
    } catch (error) {
      tell($, 'session.start', error)
    }
    try {
      // One timer at a time, should the session start again.
      tick?.cancel()
      tick = $.clock.every(TICK_MS, () => {
        readClock($)
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

  // A clear, a resume or a fork drops the theme, which is display only: set it again, if it was this one.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    try {
      if (isOn && isStanding()) await setTheme($)
    } catch (error) {
      tell($, 'SessionStart', error)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // The main loop starts work: the light breathes in, and a glow rises for a message sent.
  on('turn.start', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    try {
      work = 1
      // Only a typed prompt is a message sent: a continuation or a wake-up starts a turn with none.
      if (e.text !== '') sends += 1
      redraw($)
    } catch (error) {
      tell($, 'turn.start', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // Each of the main loop's calls swells the warmth a little; a failed one turns it rose.
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    try {
      if (e.agentId === undefined && out.deny === undefined) {
        calls += 1
        if (out.isError === true) errs += 1
        redraw($)
      }
    } catch (error) {
      tell($, 'tool.call', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // The main loop's turn ends: the light settles, with a wash from the right for a turn that finished.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    try {
      work = 0
      if (!e.isAborted) turns += 1
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
    // A Claude Code from before shaders (2.1.326) has no `Shader` in its table and would
    // refuse the tree, so there the still picture draws alone, as it does where the shader can't run.
    if (Shader === undefined) return <Svg source={stillSvg(isNight(hour))} alt={STILL_ALT} />
    return (
      <Shader module="./shader.ts" values={{ work, calls: bounce(calls), errs: bounce(errs), turns: bounce(turns), sends: bounce(sends), night, warm }}>
        <Svg source={stillSvg(isNight(hour))} alt={STILL_ALT} />
      </Shader>
    )
  })

  on('command.run', { command: 'light-leak' }, async ($, e) => {
    try {
      return { text: await command($, e.args) }
    } catch (error) {
      tell($, '/light-leak', error)
      return { text: `${TITLE} could not do that: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
