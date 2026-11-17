import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeResult, Timer } from 'claude-code'

import type { RoomCard } from '../types'
import { buildCard, buildGlance } from './card'
import { COLORS, GLASS } from './look'
import { caption, describeRoom, freshOutcome, isTestCommand, modeLabel, noteCall, phaseAt, roomState, soundFor, spinnerPhrase } from './room'
import type { Cat, Phase, RoomState, Sound } from './room'
import { buildScene } from './scene'

const PLUGIN = 'pixel-room'
const PANE = 'pixel-room'
const TITLE = 'Pixel Room'
const SCENES = ['room-a', 'room-b'] as const
/** How often the room checks the time of day between turns. */
const TICK_MS = 10 * 60_000
const GAIN = 0.5
const UNDRAWN = "This window doesn't draw backdrops; the room shows in the desktop and mobile apps."
const HELP = 'Try /pixel-room, or off, on, mute, unmute, card, card off or card on.'

const IDLE: RoomCard = { cat: 'asleep', phase: 'day', turns: 0, plant: 'neutral', isWorking: false }
// What the card draws; tagged so a value an older version stored is read as IDLE.
const card = atom({ plugin: 'pixel-room', key: 'card' } as const, IDLE, { shape: 'card-1' })

// The module's own state: a reload starts it over and session.start runs again.
let cat: Cat = 'asleep'
let phase: Phase = 'day'
// Each change draws under the other scene name, which is what makes the app draw the backdrop afresh.
let flip = 0
let isOn = true
let isMuted = false
let isCardOn = true
let lastSet: ThemeResult | undefined
let outcome = freshOutcome()
let tick: Timer | undefined
let turn = 0
let turns = 0
let isWorking = false
let plant: RoomCard['plant'] = 'neutral'
// What has already moved the cat this turn, so each moves it once at most.
let hasWatched = false
let hasStartled = false
// Whether the card was offered as a widget this session.
let hasOffered = false
// The last scene built, for a second window or a resize that asks again for the same room.
let built: { key: string; source: string } | undefined

const state = (): RoomState => roomState(cat, phase)

/** One line to the debug log: a fault in this mod never reaches the session. */
function tell($: EngineInterface, step: string, error: unknown): void {
  try {
    $.ui.log(`${step} failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } catch {
    // Nowhere left to tell it.
  }
}

/** The card's view of the room: a stretch is over by the time anyone looks, so it shows the cat asleep. */
async function sync($: EngineInterface): Promise<void> {
  const view: RoomCard = { cat: cat === 'stretch' ? 'asleep' : cat, phase, turns, plant, isWorking }
  await update($, card, () => view)
}

async function setTheme($: EngineInterface): Promise<ThemeResult> {
  const look = phase === 'day' ? 'day' : 'lamplight'
  lastSet = await $.theme.set({
    colors: COLORS[look],
    backdrop: { scene: SCENES[flip % 2] ?? 'room-a', glass: GLASS[look] },
    overrideColorScheme: 'dark',
  })
  return lastSet
}

/** Draws the room afresh, under the other scene name, where it is on. */
async function redraw($: EngineInterface): Promise<void> {
  flip += 1
  if (isOn) await setTheme($)
}

/** Moves the cat, redrawing only when it changed. */
async function move($: EngineInterface, next: Cat): Promise<void> {
  if (cat === next) return
  cat = next
  await redraw($)
}

/** Reads the local hour; true when the time of day turned since the last look. */
async function checkPhase($: EngineInterface): Promise<boolean> {
  const now = phaseAt(new Date(await $.clock.now()).getHours())
  const changed = now !== phase
  phase = now
  return changed
}

/** Plays a sound without waiting on it; a clip that can't play goes to the debug log. */
function chime($: EngineInterface, sound: Sound): void {
  try {
    $.audio.play({ asset: `sounds/${sound}.wav` }, { gain: GAIN }).catch(error => tell($, `playing ${sound}`, error))
  } catch (error) {
    tell($, `playing ${sound}`, error)
  }
}

/** The scene for now, its clock set to the local time; rebuilt at most once a minute. */
async function scene($: EngineInterface): Promise<string> {
  const date = new Date(await $.clock.now())
  const now = state()
  const key = `${now.cat}|${now.phase}|${date.getHours()}:${date.getMinutes()}`
  if (built?.key === key) return built.source
  built = { key, source: buildScene(now, { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() }) }
  return built.source
}

function alt(): string {
  const when = phase === 'night' ? 'at night, the desk lamp lit' : phase === 'dusk' ? 'at dusk, the desk lamp lit' : 'on a grey afternoon'
  return `A pixel room ${when}: rain on the window and a cat ${caption(cat)}`
}

/** Opens the card as a small widget beside the chat, once a session, where the desktop app draws one. */
function offerCard($: EngineInterface): void {
  if (hasOffered || !isOn || !isCardOn) return
  hasOffered = true
  $.ui.open({ id: PANE, title: TITLE, placement: 'widget' }).catch(error => tell($, 'the card', error))
}

function cups(count: number): string {
  return `${count} ${count === 1 ? 'cup' : 'cups'}`
}

async function command($: EngineInterface, args: string): Promise<string> {
  const word = args.trim().toLowerCase().replace(/\s+/g, ' ')
  if (word === '') {
    const lines = [describeRoom(state()), `${cups(turns)} so far; the plant looks ${plant}. ${isMuted ? 'The room is hushed.' : 'Sounds are on, softly.'}`]
    if (!isOn) lines.push('The room is dark: /pixel-room on lights it again.')
    else if (lastSet?.isDrawn === false) lines.push(UNDRAWN)
    else if (lastSet?.isDrawn === true) lines.push('The room is drawn behind this window.')
    return lines.join('\n')
  }
  if (word === 'off') {
    isOn = false
    await $.store.set('enabled', false)
    await $.theme.clear()
    await $.ui.close({ id: PANE })
    $.ui.invalidate('ui.render')
    return 'Pixel Room is off, its card and sounds too. /pixel-room on brings it back.'
  }
  if (word === 'on') {
    isOn = true
    await $.store.delete('enabled')
    await checkPhase($)
    await redraw($)
    await sync($)
    $.ui.invalidate('ui.render')
    return 'Pixel Room is on.'
  }
  if (word === 'mute') {
    isMuted = true
    await $.store.set('muted', true)
    return 'Sounds are muted. /pixel-room unmute brings them back.'
  }
  if (word === 'unmute') {
    isMuted = false
    await $.store.delete('muted')
    return 'Sounds are on.'
  }
  if (word === 'card') {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return opened.isPlaced ? 'The room card is open.' : 'The room card opens once a window can show it.'
  }
  if (word === 'card off') {
    isCardOn = false
    await $.store.set('card', false)
    await $.ui.close({ id: PANE })
    return 'The room card is put away, here and in later sessions. /pixel-room card on brings it back.'
  }
  if (word === 'card on') {
    isCardOn = true
    await $.store.delete('card')
    await $.ui.open({ id: PANE, title: TITLE, placement: 'widget' })
    return 'The room card is back.'
  }
  return HELP
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'pixel-room',
        description: 'The pixel room: how it stands, or "off", "on", "mute", "unmute", "card", "card off" or "card on"',
        argumentHint: '[off | on | mute | unmute | card [off | on]]',
      })
    } catch (error) {
      // A refused command costs the room nothing.
      tell($, '/pixel-room', error)
    }
    try {
      isOn = (await $.store.get('enabled')) !== false
      isMuted = (await $.store.get('muted')) === true
      isCardOn = (await $.store.get('card')) !== false
      await checkPhase($)
      if (isOn) await setTheme($)
      await sync($)
      if (e.surface === 'desktop') offerCard($)
    } catch (error) {
      tell($, 'session.start', error)
    }
    try {
      // One timer at a time, should the session start again.
      tick?.cancel()
      tick = $.clock.every(TICK_MS, () => {
        checkPhase($)
          .then(async changed => {
            if (!changed) return
            await redraw($)
            await sync($)
          })
          .catch(error => tell($, 'the clock', error))
      })
    } catch (error) {
      tell($, 'the clock', error)
    }
    return next(e)
  })

  // The desktop app often joins after the session starts: offer the card then.
  on('session.attach', { surface: 'desktop' }, ($, e, next) => {
    try {
      offerCard($)
    } catch (error) {
      tell($, 'session.attach', error)
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

  // The main loop starts work: the cat wakes and paces.
  on('turn.start', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    outcome = freshOutcome()
    turn += 1
    isWorking = true
    hasWatched = false
    hasStartled = false
    try {
      const turned = await checkPhase($)
      if (cat !== 'pacing') await move($, 'pacing')
      else if (turned) await redraw($)
      await sync($)
    } catch (error) {
      tell($, 'turn.start', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // Every tool call, a subagent's included, counts toward the turn; the main loop's move the cat.
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    try {
      if (out.deny !== undefined) return out
      const tool = String(e.tool)
      const input = e as unknown as Record<string, unknown>
      const line = input.command
      const isTestRun =
        (tool === 'Bash' || tool === 'PowerShell') &&
        typeof line === 'string' &&
        input.run_in_background !== true &&
        isTestCommand(line)
      const isError = out.isError === true
      const before = cat
      outcome = noteCall(outcome, { isError, isTestRun })
      if (isTestRun) plant = isError ? 'droopy' : 'perky'
      if (isWorking && e.agentId === undefined) {
        // The first error of a turn startles the cat, once; the first call sits it down to watch.
        if (isError && !hasStartled) {
          hasStartled = true
          hasWatched = true
          await move($, 'startled')
        } else if (!hasWatched) {
          hasWatched = true
          await move($, 'watching')
        }
      }
      if (isTestRun || cat !== before) await sync($)
    } catch (error) {
      tell($, 'tool.call', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // The main loop's turn ends: the cat stretches and curls up after a clean turn, or just curls up.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    isWorking = false
    turns += 1
    let sound: Sound | undefined
    try {
      sound = soundFor(outcome, { isAborted: e.isAborted, reason: e.reason })
      const turned = await checkPhase($)
      const settle: Cat = sound === 'finish' ? 'stretch' : 'asleep'
      if (cat !== settle) await move($, settle)
      else if (turned) await redraw($)
      await sync($)
    } catch (error) {
      tell($, 'turn.complete', error)
    }
    try {
      if (isOn && !isMuted && sound !== undefined) chime($, sound)
    } catch (error) {
      tell($, 'turn.complete', error)
    }
    outcome = freshOutcome()
    return out
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    if (!(SCENES as readonly string[]).includes(e.props.scene)) return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg isInteractive source={await scene($)} alt={alt()} />
  })

  // The working line speaks of the room: one phrase a turn for each thing the turn does.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (!isOn || e.props.message !== null) return next(e)
    // The desktop's row names its step; only its bare "Working" is the room's to change.
    if (e.surface !== 'terminal' && e.props.word !== 'Working') return next(e)
    return next({ ...e, props: { ...e.props, word: spinnerPhrase(turn, e.props.mode) } })
  })

  // One quiet label in the footer.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!isOn) return next(e)
    const view = await read($, card)
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, modeLabel(roomState(view.cat, view.phase))] } })
  })

  // The room card: a portrait and three small instruments, or just the portrait as a widget.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await read($, card)
    const words = `The cat is ${caption(view.cat)}.`
    const tally = `${cups(view.turns)} · plant ${view.plant}`
    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text>{words}</Text>
          <Text dimColor>{`${modeLabel(roomState(view.cat, view.phase))} · ${tally}`}</Text>
        </Box>
      )
    }
    const { Box, Svg, Text } = $.ui.resolve(e)
    if (e.props.placement === 'widget') {
      return (
        <Box flexDirection="column">
          <Svg isInteractive source={buildGlance(view)} alt={`The cat, ${caption(view.cat)}`} />
          <Text dimColor>{caption(view.cat)}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Svg isInteractive source={buildCard(view)} alt={`The cat, ${caption(view.cat)}; ${tally}`} />
        <Text>{words}</Text>
        <Text dimColor>{tally}</Text>
      </Box>
    )
  })

  on('command.run', { command: 'pixel-room' }, async ($, e) => {
    try {
      return { text: await command($, e.args) }
    } catch (error) {
      tell($, '/pixel-room', error)
      return { text: `Pixel Room could not do that: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
}
