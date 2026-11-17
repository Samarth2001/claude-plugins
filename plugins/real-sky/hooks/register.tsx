import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface, ThemeResult, Timer } from 'claude-code'

import { cardAlt, cardLines, cardSvg, glanceSvg } from './card'
import { GLASS_WORDS, LOOKS, veil } from './look'
import type { Glass } from './look'
import {
  PHASES,
  SEVERITY,
  clockText,
  dateText,
  emptyLog,
  emptyTally,
  isTestCommand,
  localTime,
  logError,
  logTurn,
  moonAge,
  moonName,
  phaseAt,
  progressAt,
  stepOf,
  weatherOf,
} from './phase'
import type { Phase, Tally, Weather } from './phase'
import { buildScene } from './scene'
import { modeLabel, spinnerWord, summary } from './voice'
import type { Sky } from '../types'

const PLUGIN = 'real-sky'
const PANE = 'almanac'
const TITLE = 'Almanac'
const SCENES = ['sky-a', 'sky-b'] as const
/** How often the sky looks at the clock. */
const TICK_MS = 5 * 60_000
const UNDRAWN = "This window doesn't draw backdrops; the sky shows in the desktop and mobile apps."
const HELP =
  'Try /real-sky, /real-sky almanac, /real-sky off or on, /real-sky dawn, day, dusk, night or auto, /real-sky almanac off or on, /real-sky glass clear, soft or frosted, or /real-sky forget.'

// What the drawings read: the sky as last set, and the session barometer. Both outlive a reload.
const skyState = atom({ plugin: 'real-sky', key: 'sky' } as const, null, { shape: 'sky-1' })
const logState = atom({ plugin: 'real-sky', key: 'log' } as const, emptyLog(), { shape: 'log-1' })
/** The almanac opened unasked once this session; a reload does not open it again. */
const offered = atom({ plugin: 'real-sky', key: 'offered' } as const, false)

/** What the sky shows: a part of the day, how far through it, the weather and the hour. */
type View = Omit<Sky, 'isOn' | 'isPinned'>

// The module's own state: a reload starts it over and session.start runs again.
let isOn = true
/** A part of the day pinned with /real-sky, or undefined to follow the clock. */
let pinned: Phase | undefined
let glass: Glass = 'soft'
let weather: Weather = 'clear'
let tally: Tally = emptyTally()
// Each update draws under the other scene name, which is what makes the app draw the backdrop afresh.
let flip = 0
let lastSet: ThemeResult | undefined
/** The view the theme was last set for, which the backdrop draws. */
let shown: View | undefined
let timer: Timer | undefined
let built: { key: string; source: string } | undefined

const keyOf = (view: View) => `${view.phase}:${view.step}:${view.weather}`
const isPhase = (word: string): word is Phase => (PHASES as readonly string[]).includes(word)

/** One line to the debug log: a fault in this mod never reaches the session. */
function tell($: EngineInterface, step: string, error: unknown): void {
  try {
    $.ui.log(`${step} failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } catch {
    // Nowhere left to tell it.
  }
}

async function view($: EngineInterface): Promise<View> {
  const now = await $.clock.now()
  const { hour, minute } = localTime(now)
  const sky = { weather, hour, minute, moonAge: Math.round(moonAge(now) * 100) / 100, date: dateText(now) }
  if (pinned !== undefined) return { ...sky, phase: pinned, step: 0.5 }
  return { ...sky, phase: phaseAt(hour, minute), step: stepOf(progressAt(hour, minute)) }
}

async function setTheme($: EngineInterface, next: View): Promise<ThemeResult> {
  const look = LOOKS[next.phase]
  shown = next
  const sky: Sky = { ...next, isOn: true, isPinned: pinned !== undefined }
  await update($, skyState, () => sky)
  lastSet = await $.theme.set({
    colors: look.colors,
    backdrop: { scene: SCENES[flip % 2] ?? 'sky-a', glass: veil(look.glass, glass) },
    overrideColorScheme: look.scheme,
  })
  return lastSet
}

/** Sets the theme again when what the sky shows has changed, or always with `force`. */
async function refresh($: EngineInterface, force = false): Promise<void> {
  if (!isOn) return
  const next = await view($)
  if (!force && shown !== undefined && keyOf(shown) === keyOf(next)) return
  if (shown !== undefined) flip += 1
  await setTheme($, next)
}

const FALLBACK: View = { phase: 'night', step: 0.5, weather: 'clear', hour: 0, minute: 0, moonAge: 7.4, date: '' }

function scene(): string {
  const at = shown ?? FALLBACK
  const key = `${keyOf(at)}:${at.hour}:${at.minute}:${at.moonAge}`
  if (built?.key !== key) {
    const input = { phase: at.phase, progress: at.step, weather: at.weather, moonAge: at.moonAge, time: { hour: at.hour, minute: at.minute } }
    built = { key, source: buildScene(input) }
  }
  return built.source
}

function alt(): string {
  const at = shown ?? FALLBACK
  const sky = { clear: 'a clear', cloudy: 'a cloudy', storm: 'a stormy' }[at.weather]
  const body = at.phase === 'night' ? `a ${moonName(at.moonAge)}` : 'the sun'
  return `${sky} ${at.phase} sky at ${clockText(at.hour, at.minute)}, ${body} on a hairline arc above a low, misty horizon`
}

/** The almanac's sky: what the theme was set for, or, before that or while off, the clock's. */
async function skyNow($: EngineInterface): Promise<Sky> {
  const sky = await read($, skyState)
  if (sky !== null) return sky
  return { ...(await view($)), isOn, isPinned: pinned !== undefined }
}

/** Opens the almanac as a widget, once a session, where the desktop app draws and the person has not said no. */
async function offer($: EngineInterface, surface: RenderSurface | null): Promise<void> {
  if (surface !== 'desktop') return
  if (await read($, offered)) return
  if ((await $.store.get('almanac')) === false) return
  await update($, offered, () => true)
  await $.ui.open({ id: PANE, title: TITLE, placement: 'widget' })
}

async function almanac($: EngineInterface, word: string): Promise<string> {
  if (word === 'off') {
    await $.store.set('almanac', false)
    await $.ui.close({ id: PANE })
    return 'The almanac is closed and opens only when asked. /real-sky almanac on opens it at each start again.'
  }
  if (word === 'on') await $.store.delete('almanac')
  else if (word !== '') return HELP
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  const said = word === 'on' ? 'The almanac opens at each start in the desktop app again.' : 'The almanac is open.'
  return opened.isPlaced ? said : `${said} It shows once a window draws panes here.`
}

async function command($: EngineInterface, args: string): Promise<string> {
  const [first = '', ...rest] = args.trim().toLowerCase().split(/\s+/)
  if (first === '') {
    const lines = summary(await skyNow($), await read($, logState))
    if (pinned !== undefined) lines.push(`Pinned to ${pinned}; /real-sky auto follows the clock again.`)
    if (!isOn) lines.push('The sky is off; /real-sky on brings it back.')
    else if (lastSet?.isDrawn === false) lines.push(UNDRAWN)
    return lines.join('\n')
  }
  if (first === 'almanac') return almanac($, rest.join(' '))
  if (first === 'glass') {
    const next = rest.join(' ') as Glass
    if (!GLASS_WORDS.includes(next)) return `The glass is ${glass}. Try /real-sky glass clear, soft or frosted.`
    glass = next
    if (glass === 'soft') await $.store.delete('glass')
    else await $.store.set('glass', glass)
    await refresh($, true)
    return `The glass is ${glass}.`
  }
  if (rest.length > 0) return HELP
  if (first === 'off') {
    isOn = false
    await $.store.set('enabled', false)
    await $.theme.clear()
    await update($, skyState, sky => (sky === null ? null : { ...sky, isOn: false }))
    await $.ui.close({ id: PANE })
    return 'The sky is off. /real-sky on brings it back.'
  }
  if (first === 'forget') {
    // Before a removal: every choice it kept goes. The theme is cleared only if it is this one's.
    const wasOn = isOn
    isOn = false
    pinned = undefined
    glass = 'soft'
    for (const key of await $.store.keys()) await $.store.delete(key)
    if (wasOn) await $.theme.clear()
    await update($, skyState, sky => (sky === null ? null : { ...sky, isOn: false }))
    await $.ui.close({ id: PANE })
    return 'Real Sky forgot what it kept and is off until it loads again.'
  }
  if (first === 'on') {
    isOn = true
    await $.store.delete('enabled')
    await refresh($, true)
    return 'The sky is back.'
  }
  if (first === 'auto') {
    pinned = undefined
    await $.store.delete('phase')
    await refresh($, true)
    return 'The sky follows your clock.'
  }
  if (isPhase(first)) {
    pinned = first
    await $.store.set('phase', first)
    await refresh($, true)
    return `The sky is pinned to ${first}; /real-sky auto follows the clock again.`
  }
  return HELP
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'real-sky',
        description: 'The almanac: where the sky stands, or "almanac", "off", "on", a part of the day to pin, "auto", "glass clear|soft|frosted", or "forget" to delete what it kept',
        argumentHint: '[almanac [off | on] | off | on | dawn | day | dusk | night | auto | glass clear|soft|frosted | forget]',
      })
    } catch (error) {
      // A refused command costs the sky nothing.
      tell($, '/real-sky', error)
    }
    try {
      isOn = (await $.store.get('enabled')) !== false
      const stored = await $.store.get('phase')
      pinned = typeof stored === 'string' && isPhase(stored) ? stored : undefined
      const kept = await $.store.get('glass')
      glass = GLASS_WORDS.includes(kept as Glass) ? (kept as Glass) : 'soft'
      if (isOn) await setTheme($, await view($))
    } catch (error) {
      tell($, 'session.start', error)
    }
    try {
      // One timer, whichever start this is: the sun moves and the day turns over with the clock.
      timer?.cancel()
      timer = $.clock.every(TICK_MS, () => {
        refresh($).catch(error => tell($, 'the clock tick', error))
      })
    } catch (error) {
      tell($, 'the clock', error)
    }
    try {
      if (isOn) await offer($, e.surface)
    } catch (error) {
      tell($, 'the almanac', error)
    }
    return next(e)
  })

  // The desktop app can attach after the session starts: offer the almanac there too.
  on('session.attach', async ($, e, next) => {
    try {
      if (isOn) await offer($, e.surface)
    } catch (error) {
      tell($, 'the almanac', error)
    }
    return next(e)
  })

  // A clear, a resume or a fork drops the theme, which is display only: set it again.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    try {
      await refresh($, true)
    } catch (error) {
      tell($, 'SessionStart', error)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Every tool call, a subagent's included: the engine's answer first, then what it says of the weather.
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    try {
      if (out.deny !== undefined) return out
      const tool = String(e.tool)
      const failed = out.isError === true
      let isTest = false
      if (tool === 'Bash' || tool === 'PowerShell') {
        const input = e as unknown as Record<string, unknown>
        const line = input.command
        // A command sent to the background has not passed or failed anything yet.
        if (typeof line === 'string' && input.run_in_background !== true && isTestCommand(line)) {
          isTest = true
          tally.passed = !failed
          tally.testFailed = failed
        }
      }
      if (failed) {
        tally.errors += 1
        await update($, logState, log => logError(log, isTest))
      }
      // Weather that worsens shows at once; it clears only when the turn ends.
      const now = weatherOf(tally)
      if (SEVERITY[now] > SEVERITY[weather]) {
        weather = now
        await refresh($)
      }
    } catch (error) {
      tell($, 'tool.call', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // The main loop's turn ends: its calls, and its subagents', settle the weather and move the barometer.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    const taken = tally
    tally = emptyTally()
    try {
      await update($, logState, log => logTurn(log, taken))
      weather = weatherOf(taken)
      await refresh($)
    } catch (error) {
      tell($, 'turn.complete', error)
    }
    return out
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    if (!(SCENES as readonly string[]).includes(e.props.scene)) return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg isInteractive source={scene()} alt={alt()} />
  })

  // The spinner says what the sky is doing, sampled once a turn. A message the engine sets stands,
  // and on desktop so does a word that says what the step is doing.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.props.message !== null) return next(e)
    if (e.surface === 'desktop' && e.props.word !== 'Working') return next(e)
    const sky = await read($, skyState)
    if (sky === null || !sky.isOn) return next(e)
    const { turns } = await read($, logState)
    return next({ ...e, props: { ...e.props, word: spinnerWord(sky.phase, sky.weather, turns, e.requestId) } })
  })

  // One quiet label among the footer's modes: `dusk · clear`.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const sky = await read($, skyState)
    if (sky === null || !sky.isOn) return next(e)
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, modeLabel(sky.phase, sky.weather)] } })
  })

  // The almanac: one card drawn as an Svg, a glance as a widget, a few lines of text where no Svg draws.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const sky = await skyNow($)
    const log = await read($, logState)
    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          {cardLines(sky, log, e.props.bodyColumns).map(line => (
            <Text dimColor={line.isDim}>{line.text}</Text>
          ))}
        </Box>
      )
    }
    const { Svg } = $.ui.resolve(e)
    const isGlance = e.props.placement === 'widget'
    return <Svg source={isGlance ? glanceSvg(sky, log) : cardSvg(sky, log)} alt={cardAlt(sky, log)} />
  })

  on('command.run', { command: 'real-sky' }, async ($, e) => {
    try {
      return { text: await command($, e.args) }
    } catch (error) {
      tell($, '/real-sky', error)
      return { text: `The sky could not do that: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
