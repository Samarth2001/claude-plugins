import { atom, read, update } from 'claude-code'
import type { Register, RenderElement, SessionUsage } from 'claude-code'

import type { Limit, Snapshot } from '../types'
import { face, svg, tone } from './creature'
import type { Mood } from './creature'

const snapshot = atom({ plugin: 'buddy', key: 'snapshot' } as const, null)
const isHidden = atom({ plugin: 'buddy', key: 'isHidden' } as const, false)

const FRAME_MS = 400
const NARROW_COLUMNS = 90
const WIDE_COLUMNS = 140
const DONE_MS = 3000
const ERROR_MS = 2000
const SLEEP_AFTER_MS = 2 * 60_000
const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

type Activity = { mood: Mood; verb: string; target?: string }

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

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function toSnapshot(usage: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Snapshot {
  return {
    percent: usage.context.percent,
    tokens: usage.context.tokens,
    window: usage.context.window,
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
    await update($, snapshot, () => toSnapshot(usage))
    model = await $.session.model()
    lastActiveAt = await $.clock.now()

    // One calm pace for everything: props drift, the idle face blinks, timers tick.
    $.clock.every(FRAME_MS, () => {
      frame += 1
      $.ui.invalidate('ui.render')
    })

    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))

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
      status = 'context nearly full · try /compact'
    } else if (now - lastActiveAt > SLEEP_AFTER_MS) {
      mood = 'sleeping'
      status = 'idle'
    } else {
      mood = 'idle'
      status = 'ready'
    }

    const columns = e.props.bodyColumns
    const isNarrow = columns < NARROW_COLUMNS
    const isWide = columns >= WIDE_COLUMNS
    const { Box, Button, Text } = $.ui.resolve(e)

    // Numbers stay dim until they need attention.
    const level = (value: number) =>
      value >= 90 ? <Text color="red">{value}%</Text> : value >= 75 ? <Text color="yellow">{value}%</Text> : <Text dimColor>{value}%</Text>
    const sep = () => <Text dimColor> · </Text>

    const stats: RenderElement[] = [<Text dimColor>ctx </Text>, snap.percent === undefined ? <Text dimColor>–</Text> : level(percent)]
    if (isWide && snap.tokens !== undefined) {
      stats.push(<Text dimColor> {formatTokens(snap.tokens)}/{formatTokens(snap.window)}</Text>)
    }
    for (const limit of snap.limits) {
      const isPrimary = limit.kind === 'five_hour'
      const isHot = limit.percentUsed >= 75
      if (!isPrimary && !isHot && (isNarrow || !isWide)) continue
      stats.push(sep(), <Text dimColor>{LIMIT_LABELS[limit.kind] ?? limit.kind} </Text>, level(limit.percentUsed))
      if (isHot && limit.resetsAt && !isNarrow) {
        stats.push(<Text dimColor> ↻{formatUntil(limit.resetsAt, now)}</Text>)
      }
    }
    if (snap.usd !== undefined) {
      stats.push(sep(), <Text dimColor>${snap.usd.toFixed(2)}</Text>)
    }
    if (isWide) {
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

    const feel = tone(percent, mood)
    const statusText =
      feel === 'alarm' && mood !== 'idle' && mood !== 'sleeping' ? <Text color="red">{status}</Text> : <Text dimColor>{status}</Text>
    const right = (
      <Box key="right">
        {stats}
        <Text>  </Text>
        <Button key="hide" label="hide" dimColor onPress={() => update($, isHidden, () => true)} />
      </Box>
    )

    if (e.surface === 'terminal') {
      const faceText = face(mood, frame)
      return (
        <Box>
          {feel === 'calm' ? <Text dimColor>{faceText}</Text> : <Text color={feel === 'warn' ? 'yellow' : 'red'}>{faceText}</Text>}
          <Text> </Text>
          {statusText}
          <Box flexGrow={1} />
          {right}
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    return (
      <Box alignItems="center">
        <Svg source={svg(mood, percent)} alt={`Companion is ${mood}: ${status}`} width={48} height={22} isInteractive />
        <Text> </Text>
        {statusText}
        <Box flexGrow={1} />
        {right}
      </Box>
    )
  })
}
