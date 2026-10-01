import { atom, read, update } from 'claude-code'
import type { Register, RenderElement, SessionUsage } from 'claude-code'

import type { Limit, Snapshot } from '../types'
import { bodyColor, face, svg } from './creature'
import type { Mood } from './creature'

const snapshot = atom({ plugin: 'buddy', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'buddy', key: 'isHidden' } as const, false)

const FRAME_MS = 150
const IDLE_EVERY = 4 // idle frames advance once every 4 ticks
const DONE_MS = 3000
const ERROR_MS = 2000
const SLEEP_AFTER_MS = 2 * 60_000
const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

type Activity = { mood: Mood; verb: string; target?: string }

function levelColor(percent: number): string {
  if (percent >= 90) return 'red'
  if (percent >= 75) return 'magenta'
  if (percent >= 50) return 'yellow'
  return 'green'
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

function formatUntil(resetsAt: string, now: number): string {
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60_000))
  if (minutes >= 24 * 60) return `${Math.floor(minutes / 1440)}d${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60}m`
  return `${minutes}m`
}

function bar(percent: number, cells: number): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function toSnapshot(usage: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>, previous: Snapshot | null): Snapshot {
  const tokens = usage.context.tokens
  const lastTurnAdded =
    tokens !== undefined && previous?.tokens !== undefined ? tokens - previous.tokens : previous?.lastTurnAdded

  return {
    percent: usage.context.percent,
    tokens,
    window: usage.context.window,
    lastTurnAdded,
    usd: usage.cost?.usd,
    limits: usage.rateLimits.map(({ kind, percentUsed, resetsAt }): Limit => ({ kind, percentUsed, resetsAt })),
  }
}

// What a tool call looks like to the companion: a mood, a verb and what it acts on.
function activityOf(tool: string, input: Record<string, unknown>): Activity {
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)
  const path = text('file_path') ?? text('notebook_path') ?? text('path')

  switch (tool) {
    case 'Read':
      return { mood: 'reading', verb: 'reading', target: path && basename(path) }
    case 'Grep':
    case 'Glob':
      return { mood: 'reading', verb: 'searching', target: text('pattern') }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return { mood: 'editing', verb: tool === 'Write' ? 'writing' : 'editing', target: path && basename(path) }
    case 'Bash':
      return { mood: 'running', verb: 'running', target: text('command')?.split(/\s+/).slice(0, 2).join(' ') }
    case 'WebFetch':
      return { mood: 'browsing', verb: 'fetching', target: text('url')?.replace(/^https?:\/\//, '').split('/')[0] }
    case 'WebSearch':
      return { mood: 'browsing', verb: 'searching the web', target: text('query') }
    case 'Agent':
    case 'Task':
      return { mood: 'delegating', verb: 'delegating', target: text('description') }
    default:
      return tool.startsWith('mcp__')
        ? { mood: 'working', verb: 'using', target: tool.split('__').slice(1).join(' ') }
        : { mood: 'working', verb: 'using', target: tool }
  }
}

export const register: Register = on => {
  let frame = 0
  let isWorking = false
  let turnStartedAt = 0
  let lastActiveAt = 0
  let toolsThisTurn = 0
  let doneUntil = 0
  let errorUntil = 0
  let model = ''
  let activity: Activity | null = null
  const filesTouched = new Set<string>()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await update($, snapshot, previous => toSnapshot(usage, previous))
    model = await $.session.model()
    lastActiveAt = await $.clock.now()

    $.clock.every(FRAME_MS, () => {
      frame += 1
      const isAnimating = isWorking || doneUntil > 0 || errorUntil > 0
      // Fast frames while something moves, slow ones while idle (blinks, countdowns).
      if (isAnimating || frame % IDLE_EVERY === 0) {
        $.ui.invalidate('ui.render')
      }
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, previous => toSnapshot(e, previous))

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    isWorking = true
    toolsThisTurn = 0
    doneUntil = 0
    errorUntil = 0
    turnStartedAt = await $.clock.now()
    lastActiveAt = turnStartedAt

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const current = activityOf(e.tool, input)
    activity = current
    toolsThisTurn += 1
    if (current.mood === 'editing' && typeof input.file_path === 'string') {
      filesTouched.add(input.file_path)
    }

    const result = await next(e)
    if (activity === current) activity = null
    if (result.deny === undefined && result.isError === true) {
      errorUntil = (await $.clock.now()) + ERROR_MS
    }

    return result
  })

  on('turn.complete', async ($, e, next) => {
    isWorking = false
    activity = null
    const now = await $.clock.now()
    lastActiveAt = now
    doneUntil = now + DONE_MS
    model = await $.session.model()

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden))) {
      return next(e)
    }

    const now = await $.clock.now()
    isWorking = e.props.isWorking
    if (doneUntil <= now) doneUntil = 0
    if (errorUntil <= now) errorUntil = 0

    const percent = snap.percent ?? 0
    const isSweating = percent >= 75 && percent < 90

    let mood: Mood
    let status: string
    if (errorUntil > 0) {
      mood = 'error'
      status = 'that failed'
    } else if (isWorking) {
      mood = activity?.mood ?? 'thinking'
      const elapsed = formatDuration(now - turnStartedAt)
      status = activity
        ? `${activity.verb}${activity.target ? ` ${activity.target.slice(0, 28)}` : ''} · ${elapsed}`
        : `thinking · ${elapsed}`
    } else if (doneUntil > 0) {
      mood = 'done'
      status = 'done'
    } else if (percent >= 90) {
      mood = 'full'
      status = 'context nearly full, try /compact'
    } else if (now - lastActiveAt > SLEEP_AFTER_MS) {
      mood = 'sleeping'
      status = 'idle'
    } else {
      mood = 'idle'
      status = 'ready'
    }

    const isFast = mood !== 'idle' && mood !== 'sleeping' && mood !== 'full'
    const tick = isFast ? frame : Math.floor(frame / IDLE_EVERY)
    const isNarrow = e.props.bodyColumns < 110
    const color = levelColor(percent)

    const stats: RenderElement[] = []
    const { Box, Button, Text } = $.ui.resolve(e)
    const sep = () => <Text dimColor> · </Text>

    stats.push(
      <Text dimColor>ctx </Text>,
      <Text color={color}>{bar(percent, isNarrow ? 6 : 10)}</Text>,
      <Text color={color}> {snap.percent === undefined ? '–' : `${percent}%`}</Text>,
    )
    if (!isNarrow) {
      stats.push(<Text dimColor> {formatTokens(snap.tokens ?? 0)}/{formatTokens(snap.window)}</Text>)
      if (snap.lastTurnAdded !== undefined && snap.lastTurnAdded !== 0) {
        stats.push(<Text dimColor> {snap.lastTurnAdded > 0 ? '+' : '-'}{formatTokens(Math.abs(snap.lastTurnAdded))}</Text>)
      }
    }
    for (const limit of snap.limits) {
      stats.push(
        sep(),
        <Text dimColor>{LIMIT_LABELS[limit.kind] ?? limit.kind} </Text>,
        <Text color={levelColor(limit.percentUsed)}>{limit.percentUsed}%</Text>,
      )
      if (!isNarrow && limit.resetsAt) {
        stats.push(<Text dimColor> ↻{formatUntil(limit.resetsAt, now)}</Text>)
      }
    }
    if (snap.usd !== undefined) {
      stats.push(sep(), <Text>${snap.usd.toFixed(2)}</Text>)
    }
    if (!isNarrow) {
      if (isWorking && toolsThisTurn > 0) {
        stats.push(sep(), <Text dimColor>{toolsThisTurn} tools</Text>)
      }
      if (filesTouched.size > 0) {
        stats.push(sep(), <Text dimColor>{filesTouched.size} files edited</Text>)
      }
      if (model) {
        stats.push(sep(), <Text dimColor>{model.replace(/^claude-/, '')}</Text>)
      }
    }

    const statusColor = mood === 'error' || mood === 'full' ? 'red' : mood === 'done' ? 'green' : 'cyan'
    const hide = <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />

    if (e.surface === 'terminal') {
      return (
        <Box>
          <Text color={color} bold>{face(mood, tick, isSweating)}</Text>
          <Text color={statusColor}>{status}</Text>
          <Text dimColor>  │  </Text>
          {stats}
          <Text> </Text>
          {hide}
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    return (
      <Box>
        <Svg
          source={svg(mood, bodyColor(percent), isSweating)}
          alt={`Companion is ${mood}: ${status}`}
          width={64}
          height={32}
          isInteractive
        />
        <Text color={statusColor}> {status}</Text>
        <Text dimColor>  │  </Text>
        {stats}
        <Text> </Text>
        {hide}
      </Box>
    )
  })
}
