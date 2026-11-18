import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeResult, Timer } from 'claude-code'

import type { RoomCard } from '../types'
import { CARD_SIZE, GLANCE_SIZE, buildCard, buildGlance } from './card'
import { COLORS, GLASS_WORDS, glassFor } from './look'
import type { Glass } from './look'
import type { Cat, Flourish, LocalDate, Monitor, Notes, Phase, Plant, RoomView, SceneInput, Season, Weather } from './model'
import { NO_NOTES } from './model'
import {
  caption,
  describeRoom,
  doneWord,
  freshOutcome,
  isTestCommand,
  modeLabel,
  noteCall,
  notesTally,
  sceneAlt,
  soundFor,
  spinnerPhrase,
  todayWords,
  weatherReport,
} from './room'
import type { Sound } from './room'
import { buildScene } from './scene'
import { isSouthernZone, moonPhase, phaseAt, seasonOf, weatherFor } from './sky'

const PLUGIN = 'pixel-room'
const PANE = 'pixel-room'
const TITLE = 'Pixel Room'
const SCENES = ['room-a', 'room-b'] as const
/** How often the room checks the time of day between turns. */
const TICK_MS = 10 * 60_000
/** The longest a change of notes or moths waits for its redraw; changes in that time share one. */
const SOON_MS = 4_000
/** How long a flourish stays in the scene. */
const FLOURISH_MS = 5_000
/** The least time between two pets. */
const PET_MS = 3_000
/** How long the monitor keeps a turn's last look before its screensaver. */
const SCREENSAVER_MS = 5 * 60_000
/** Subagents shown as moths at once. */
const MOTHS = 3
const GAIN = 0.5
const WEATHERS: readonly Weather[] = ['rain', 'drizzle', 'snow', 'fog', 'clear']
// A push, wherever it sits in a chain of commands: `git push`, `git -C app push origin main`.
const PUSH = /\bgit\b[^;&|]*\bpush\b/
const UNDRAWN = "This window doesn't draw backdrops; the room shows in the desktop and mobile apps."
const DARK = 'The room is dark: /pixel-room on lights it again.'
const HELP =
  'Try /pixel-room, or off, on, mute, unmute, pet, glass clear|soft|frosted, weather [rain|drizzle|snow|fog|clear|auto], card, card off, card on or forget.'

const IDLE: RoomCard = {
  cat: 'asleep',
  phase: 'day',
  weather: 'rain',
  moon: 0.5,
  turns: 0,
  plant: 'neutral',
  isWorking: false,
  moths: 0,
  notes: NO_NOTES,
  flourish: 'none',
}
// The contract's RoomCard repeats model.ts's RoomView: this line stops compiling if the two part.
const isSameView: [RoomCard, RoomView] extends [RoomView, RoomCard] ? true : false = true
void isSameView
// What the card draws; tagged so a value an older version stored is read as IDLE.
const card = atom({ plugin: 'pixel-room', key: 'card' } as const, IDLE, { shape: 'card-2' })

// The module's own state: a reload starts it over and session.start runs again.
let cat: Cat = 'asleep'
// What is outside, from the clock: set by readSky.
let phase: Phase = 'day'
let date: LocalDate = { month: 0, day: 1, weekday: 0 }
let season: Season = 'winter'
let dayWeather: Weather = 'rain'
let moon = 0.5
// Weather the person pinned with /pixel-room weather, over the day's own.
let pinned: Weather | undefined
let monitor: Monitor = 'idle'
// When the main loop's latest turn ended, for the monitor's screensaver.
let endedAt: number | undefined
// Agent calls in flight, from any loop.
let agents = 0
// Claude's todo list (TodoWrite) and its task list (TaskCreate, TaskUpdate) by task id: only the statuses.
let todos: Notes = NO_NOTES
const tasks = new Map<string, 'pending' | 'in_progress' | 'completed'>()
let flourish: Flourish = 'none'
let flourishTimer: Timer | undefined
let lastPet: number | undefined
// Each change draws under the other scene name, which is what makes the app draw the backdrop afresh.
let flip = 0
let isOn = true
let isMuted = false
let glass: Glass = 'soft'
let lastSet: ThemeResult | undefined
// The scene the backdrop last drew, flourish aside, so a redraw happens only when something in it moved.
let drawnKey: string | undefined
// The view the card last read, so an unchanged one writes nothing.
let syncedKey: string | undefined
let soonTimer: Timer | undefined
let outcome = freshOutcome()
let tick: Timer | undefined
let turn = 0
let turns = 0
let isWorking = false
let plant: Plant = 'neutral'
// What has already moved the cat this turn, so each moves it once at most.
let hasWatched = false
let hasStartled = false
// The working line's phrase for each mode, kept for the turn.
const phrases = new Map<string, string>()
// The last scene built, for a second window or a resize that asks again for the same room.
let built: { key: string; source: string } | undefined

/** Whether the time zone's name puts the room south of the equator, where the seasons turn around. */
const isSouthern: boolean = (() => {
  try {
    return isSouthernZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return false
  }
})()

const weather = (): Weather => pinned ?? dayWeather

function notes(): Notes {
  const out = { ...todos }
  for (const status of tasks.values()) {
    if (status === 'completed') out.done += 1
    else if (status === 'in_progress') out.active += 1
    else out.open += 1
  }
  return out
}

/** Everything the backdrop draws, as the room stands. */
function sceneInput(): SceneInput {
  return {
    cat,
    phase,
    lampOn: phase !== 'day',
    weather: weather(),
    season,
    moon,
    monitor,
    moths: Math.min(agents, MOTHS),
    notes: notes(),
    flourish,
    date,
    isWorking,
  }
}

/** The card's view: a stretch is over by the time anyone looks, so it shows the cat asleep. */
function roomView(): RoomCard {
  const now = sceneInput()
  return {
    cat: cat === 'stretch' ? 'asleep' : cat,
    phase,
    weather: now.weather,
    moon,
    turns,
    plant,
    isWorking,
    moths: now.moths,
    notes: now.notes,
    flourish,
  }
}

/** One line to the debug log: a fault in this mod never reaches the session. */
function tell($: EngineInterface, step: string, error: unknown): void {
  try {
    $.ui.log(`${step} failed: ${error instanceof Error ? error.message : String(error)}`, { to: 'debug' })
  } catch {
    // Nowhere left to tell it.
  }
}

/** Reads the clock for the time of day, the date, the season, the day's weather and the moon. */
async function readSky($: EngineInterface): Promise<number> {
  const now = await $.clock.now()
  const at = new Date(now)
  phase = phaseAt(at.getHours())
  date = { month: at.getMonth(), day: at.getDate(), weekday: at.getDay() }
  season = seasonOf(date.month, isSouthern)
  dayWeather = weatherFor({ year: at.getFullYear(), month: date.month, day: date.day }, season)
  moon = moonPhase(now)
  return now
}

/** Hands the card the room as it stands, when it changed. */
async function sync($: EngineInterface): Promise<void> {
  const view = roomView()
  const key = JSON.stringify(view)
  if (key === syncedKey) return
  syncedKey = key
  await update($, card, () => view)
}

const sceneKey = (): string => JSON.stringify({ ...sceneInput(), flourish: 'none' })

async function setTheme($: EngineInterface): Promise<ThemeResult> {
  const look = phase === 'day' ? 'day' : 'lamplight'
  drawnKey = sceneKey()
  lastSet = await $.theme.set({
    colors: COLORS[look],
    backdrop: { scene: SCENES[flip % 2] ?? 'room-a', glass: glassFor(look, glass) },
    overrideColorScheme: 'dark',
  })
  return lastSet
}

/** Draws the room afresh, under the other scene name, where it is on. */
async function redraw($: EngineInterface): Promise<void> {
  flip += 1
  if (isOn) await setTheme($)
}

/** Redraws the backdrop when something in the scene moved, and hands the card the room. */
async function refresh($: EngineInterface): Promise<void> {
  if (sceneKey() !== drawnKey) await redraw($)
  await sync($)
}

/** A refresh within a few seconds, shared by every change until then: for notes and moths, never one per call. */
function soon($: EngineInterface): void {
  if (soonTimer !== undefined) return
  try {
    soonTimer = $.clock.after(SOON_MS, () => {
      soonTimer = undefined
      refresh($).catch(error => tell($, 'a redraw', error))
    })
  } catch (error) {
    tell($, 'a redraw', error)
  }
}

/** Plays a sound without waiting on it; a clip that can't play goes to the debug log. */
function chime($: EngineInterface, sound: Sound): void {
  try {
    $.audio.play({ asset: `sounds/${sound}.wav` }, { gain: GAIN }).catch(error => tell($, `playing ${sound}`, error))
  } catch (error) {
    tell($, `playing ${sound}`, error)
  }
}

/** Plays a one-shot in the scene now, and takes it out again a few seconds later. */
async function play($: EngineInterface, next: Flourish): Promise<void> {
  flourishTimer?.cancel()
  flourish = next
  await redraw($)
  await sync($)
  flourishTimer = $.clock.after(FLOURISH_MS, () => {
    flourishTimer = undefined
    flourish = 'none'
    // The backdrop's one-shot has already come to rest; only the card is told.
    sync($).catch(error => tell($, 'a flourish', error))
  })
}

/** Pets the cat: hearts and a purr, at most once every few seconds. False when it is too soon. */
async function pet($: EngineInterface): Promise<boolean> {
  const now = await $.clock.now()
  if (lastPet !== undefined && now - lastPet < PET_MS) return false
  lastPet = now
  await play($, 'pet')
  if (!isMuted) chime($, 'purr')
  return true
}

/** The scene for now, its clock set to the local time; rebuilt at most once a minute. */
async function scene($: EngineInterface): Promise<{ source: string; alt: string }> {
  const at = new Date(await $.clock.now())
  const input = sceneInput()
  const key = `${JSON.stringify(input)}|${at.getHours()}:${at.getMinutes()}`
  if (built?.key !== key) {
    built = { key, source: buildScene(input, { hour: at.getHours(), minute: at.getMinutes(), second: at.getSeconds() }) }
  }
  return { source: built.source, alt: sceneAlt(input) }
}

function cups(count: number): string {
  return `${count} ${count === 1 ? 'cup' : 'cups'}`
}

async function weatherCommand($: EngineInterface, rest: string): Promise<string> {
  if (rest === '') return weatherReport(weather(), moon, pinned !== undefined)
  if (rest === 'auto' || rest === 'day') {
    pinned = undefined
    await $.store.delete('weather')
    await redraw($)
    await sync($)
    return `Back to the day's own weather: ${todayWords(dayWeather)} today.`
  }
  const next = rest as Weather
  if (!WEATHERS.includes(next)) return 'Try /pixel-room weather rain, drizzle, snow, fog or clear to pin one, or weather auto for the day\'s own.'
  pinned = next
  await $.store.set('weather', next)
  await redraw($)
  await sync($)
  return `The weather is pinned to ${next}, here and in later sessions. /pixel-room weather auto brings back the day's own.`
}

async function command($: EngineInterface, args: string): Promise<string> {
  const word = args.trim().toLowerCase().replace(/\s+/g, ' ')
  if (word === '') {
    // A look at the room catches up with the clock first, should dusk have fallen since the last tick.
    await readSky($)
    await refresh($)
    const lines = [describeRoom(sceneInput()), `${cups(turns)} so far; the plant looks ${plant}. ${isMuted ? 'The room is hushed.' : 'Sounds are on, softly.'}`]
    if (!isOn) lines.push(DARK)
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
    await readSky($)
    await redraw($)
    await sync($)
    $.ui.invalidate('ui.render')
    return 'Pixel Room is on.'
  }
  if (word === 'forget') {
    // Before a removal: every choice it kept goes. The theme is cleared only if it is this one's.
    const wasOn = isOn
    isOn = false
    glass = 'soft'
    pinned = undefined
    for (const key of await $.store.keys()) await $.store.delete(key)
    if (wasOn) await $.theme.clear()
    await $.ui.close({ id: PANE })
    $.ui.invalidate('ui.render')
    return 'Pixel Room forgot what it kept and is off until it loads again.'
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
  if (word === 'pet') {
    if (!isOn) return DARK
    if (!(await pet($))) return 'The cat is still purring from the last one.'
    return `You pet the cat. ${isMuted ? 'It purrs, too softly to hear.' : 'It purrs.'}`
  }
  if (word === 'glass' || word.startsWith('glass ')) {
    const next = word.slice(6) as Glass
    if (!GLASS_WORDS.includes(next)) return `The glass is ${glass}. Try /pixel-room glass clear, soft or frosted.`
    glass = next
    if (glass === 'soft') await $.store.delete('glass')
    else await $.store.set('glass', glass)
    await redraw($)
    return `The glass is ${glass}.`
  }
  if (word === 'weather' || word.startsWith('weather ')) {
    await readSky($)
    await refresh($)
    return weatherCommand($, word.slice(8))
  }
  if (word === 'card') {
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    return opened.isPlaced ? 'The room card is open.' : 'The room card opens once a window can show it.'
  }
  if (word === 'card off') {
    await $.ui.close({ id: PANE })
    return 'The room card is put away. /pixel-room card brings it back.'
  }
  if (word === 'card on') {
    const opened = await $.ui.open({ id: PANE, title: TITLE, placement: 'widget' })
    return opened.isPlaced ? 'The room card is open.' : 'The room card opens once a window can show it.'
  }
  return HELP
}

/** The task list's statuses after one successful TaskCreate or TaskUpdate call. */
function noteTask(tool: 'TaskCreate' | 'TaskUpdate', input: Record<string, unknown>, result: unknown): boolean {
  const record = (result ?? {}) as Record<string, unknown>
  if (tool === 'TaskCreate') {
    const id = (record.task as Record<string, unknown> | undefined)?.id
    if (typeof id !== 'string') return false
    tasks.set(id, 'pending')
    return true
  }
  const id = input.taskId
  const status = input.status
  if (typeof id !== 'string' || record.success === false) return false
  if (status === 'deleted') return tasks.delete(id)
  if (status !== 'pending' && status !== 'in_progress' && status !== 'completed') return false
  tasks.set(id, status)
  return true
}

/** The todo list's counts from TodoWrite's new list. */
function countTodos(list: unknown): Notes | undefined {
  if (!Array.isArray(list)) return undefined
  const out = { open: 0, active: 0, done: 0 }
  for (const item of list) {
    const status = (item as { status?: unknown } | null)?.status
    if (status === 'completed') out.done += 1
    else if (status === 'in_progress') out.active += 1
    else out.open += 1
  }
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'pixel-room',
        description:
          'The pixel room: how it stands, or "pet", "weather [rain|drizzle|snow|fog|clear|auto]", "off", "on", "mute", "unmute", "glass clear|soft|frosted", "card", "card off", "card on", or "forget" to delete what it kept',
        argumentHint: '[pet | weather [rain|drizzle|snow|fog|clear|auto] | off | on | mute | unmute | glass clear|soft|frosted | card [off | on] | forget]',
      })
    } catch (error) {
      // A refused command costs the room nothing.
      tell($, '/pixel-room', error)
    }
    try {
      isOn = (await $.store.get('enabled')) !== false
      isMuted = (await $.store.get('muted')) === true
      // Settings of earlier versions with nothing left to set: the band, and the card opening by itself.
      for (const retired of ['band', 'card']) if ((await $.store.get(retired)) !== undefined) await $.store.delete(retired)
      const kept = await $.store.get('glass')
      glass = GLASS_WORDS.includes(kept as Glass) ? (kept as Glass) : 'soft'
      const sky = await $.store.get('weather')
      pinned = WEATHERS.includes(sky as Weather) ? (sky as Weather) : undefined
      await readSky($)
      if (isOn) await setTheme($)
      await sync($)
    } catch (error) {
      tell($, 'session.start', error)
    }
    try {
      // One timer at a time, should the session start again.
      tick?.cancel()
      tick = $.clock.every(TICK_MS, () => {
        readSky($)
          .then(async now => {
            // A while after a turn, the monitor goes back to its screensaver.
            if (!isWorking && monitor !== 'idle' && endedAt !== undefined && now - endedAt >= SCREENSAVER_MS) monitor = 'idle'
            await refresh($)
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

  // The main loop starts work: the cat wakes and paces, the monitor fills with code.
  on('turn.start', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined) return out
    outcome = freshOutcome()
    turn += 1
    isWorking = true
    hasWatched = false
    hasStartled = false
    phrases.clear()
    try {
      await readSky($)
      cat = 'pacing'
      monitor = 'working'
      endedAt = undefined
      await refresh($)
    } catch (error) {
      tell($, 'turn.start', error)
    }
    return out
  }).catch(($, e, next) => next(e))

  // Every tool call, a subagent's included, counts toward the turn; the main loop's move the cat.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    // A subagent runs for as long as its Agent call: a moth at the lamp meanwhile.
    const isAgent = tool === 'Agent'
    if (isAgent) {
      agents += 1
      soon($)
    }
    let out: Awaited<ReturnType<typeof next>>
    try {
      out = await next(e)
    } finally {
      if (isAgent) {
        agents = Math.max(0, agents - 1)
        soon($)
      }
    }
    try {
      if (out.deny !== undefined) return out
      const input = e as unknown as Record<string, unknown>
      const line = input.command
      const isShell = (tool === 'Bash' || tool === 'PowerShell') && typeof line === 'string' && input.run_in_background !== true
      const isTestRun = isShell && isTestCommand(line)
      const isError = out.isError === true
      const isMain = e.agentId === undefined
      const before = { cat, monitor }
      outcome = noteCall(outcome, { isError, isTestRun })
      if (isTestRun) plant = isError ? 'droopy' : 'perky'
      if (isWorking && isMain) {
        // The first error of a turn startles the cat, once, and reddens the monitor; the first call sits it down to watch.
        if (isError && !hasStartled) {
          hasStartled = true
          hasWatched = true
          cat = 'startled'
          monitor = 'error'
        } else if (!hasWatched) {
          hasWatched = true
          cat = 'watching'
        }
      }
      let isNoted = false
      if (!isError) {
        if (tool === 'TodoWrite' && isMain) {
          const counted = countTodos(input.todos)
          if (counted !== undefined) {
            todos = counted
            isNoted = true
          }
        } else if (tool === 'TaskCreate' || tool === 'TaskUpdate') {
          isNoted = noteTask(tool, input, out.result)
        }
      }
      if (cat !== before.cat || monitor !== before.monitor) await refresh($)
      else if (isNoted) soon($)
      else if (isTestRun) await sync($)
      // A paper plane over the city after a push that went through.
      if (tool === 'Bash' && isShell && !isError && PUSH.test(line)) await play($, 'plane')
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
      endedAt = await readSky($)
      cat = sound === 'finish' ? 'stretch' : 'asleep'
      monitor = sound === 'finish' ? 'done' : sound === 'failure' ? 'error' : 'idle'
      await refresh($)
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
    const drawn = await scene($)
    return <Svg isInteractive source={drawn.source} alt={drawn.alt} />
  })

  // A click on the room pets the cat. Only the plugin that set the theme hears it.
  // Hooked through `ui.*` on the backdrop, not by name: a Claude Code from before clicks reached a
  // backdrop (2.1.326) knows no `ui.pointer` and would refuse the whole module, so there the room
  // loads without it and `/pixel-room pet` still pets.
  on('ui.*', { component: 'Backdrop' }, async ($, e, next) => {
    // A plain string, so the types of a build without the event read it too.
    if ((next.event as string) !== 'ui.pointer') return next(e)
    try {
      const scene = (e as { scene?: unknown }).scene
      if (isOn && typeof scene === 'string' && (SCENES as readonly string[]).includes(scene)) await pet($)
    } catch (error) {
      tell($, 'a pet', error)
    }
    return next(e)
  })

  // The working line speaks of the room: one phrase a turn for each thing the turn does.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (!isOn || e.props.message !== null) return next(e)
    // The desktop's row names its step; only its bare "Working" is the room's to change.
    if (e.surface !== 'terminal' && e.props.word !== 'Working') return next(e)
    const mode = e.props.mode
    const word = phrases.get(mode) ?? spinnerPhrase(turn, mode, sceneInput())
    phrases.set(mode, word)
    return next({ ...e, props: { ...e.props, word } })
  })

  // The line that closes a turn on the terminal: the room's own word for it, the time kept.
  on('ui.render', { component: 'TurnDuration' }, ($, e, next) => {
    if (!isOn || e.surface !== 'terminal' || e.props.isExpanded === true || e.props.waitingFor !== undefined) return next(e)
    return next({ ...e, props: { ...e.props, word: doneWord(e.requestId) } })
  })

  // One quiet label in the footer.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!isOn) return next(e)
    const view = await read($, card)
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, modeLabel(view)] } })
  })

  // The room card: a portrait and its small instruments, or just the portrait as a widget.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await read($, card)
    const words = `The cat is ${caption(view.cat)}.`
    const tally = [cups(view.turns), `plant ${view.plant}`, notesTally(view.notes)].filter(part => part !== undefined).join(' · ')
    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          <Text>{words}</Text>
          <Text dimColor>{`${modeLabel(view)} · ${tally}`}</Text>
        </Box>
      )
    }
    const { Box, Svg, Text } = $.ui.resolve(e)
    if (e.props.placement === 'widget') {
      return (
        <Box flexDirection="column">
          <Svg isInteractive source={buildGlance(view)} alt={`The cat, ${caption(view.cat)}`} width={GLANCE_SIZE.width} height={GLANCE_SIZE.height} />
          <Text dimColor>{caption(view.cat)}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Svg isInteractive source={buildCard(view)} alt={`The cat, ${caption(view.cat)}; ${tally}`} width={CARD_SIZE.width} height={CARD_SIZE.height} />
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
