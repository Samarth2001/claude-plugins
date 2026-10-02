import { atom, read, update } from 'claude-code'
import type { Register, RenderElement, SessionUsage } from 'claude-code'

import type { Limit, Live, Mood, Reading, Snapshot } from '../types'
import { activityOf, formatDuration, formatTokens, formatUntil, meter, shorten, spark } from './format'
import { FACE, HEIGHT, WIDTH, animation, cells, frameAt, levelColor, svg } from './sprite'

const IDLE: Live = {
  turnStartedAt: 0,
  lastActiveAt: 0,
  toolsThisTurn: 0,
  doneUntil: 0,
  errorUntil: 0,
  activity: null,
  lastTurn: null,
  model: '',
  files: [],
}

const snapshot = atom({ plugin: 'buddy', key: 'snapshot' } as const, null)
const readings = atom({ plugin: 'buddy', key: 'readings' } as const, [])
const live = atom({ plugin: 'buddy', key: 'live' } as const, IDLE)
const isHidden = atom({ plugin: 'buddy', key: 'isHidden' } as const, false)
const isCompact = atom({ plugin: 'buddy', key: 'isCompact' } as const, false)

const COMPACT_KEY = 'isCompact' // in $.store, so the choice outlives the session
const DONE_MS = 4000
const ERROR_MS = 2500
const SLEEP_AFTER_MS = 2 * 60_000
const HISTORY = 16
const TICK_MS = 120
const NARROW_COLUMNS = 100
const TINY_COLUMNS = 64
const DESKTOP_SCALE = 6
const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

const MOOD_COLOR: Record<Mood, string> = {
  idle: '#9AA3B5',
  sleeping: '#9AA3B5',
  thinking: '#B4A7F5',
  reading: '#7FB2F0',
  editing: '#F2C14E',
  running: '#7BC96F',
  browsing: '#5FB8D9',
  delegating: '#E59AC4',
  working: '#C9A2F2',
  done: '#F2C14E',
  error: '#E5534B',
  full: '#E8964A',
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

export const register: Register = on => {
  // Redraw pacing only; everything drawn comes from $.state.
  let pace = 250
  let sinceDraw = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'buddy',
      description: 'Show or hide buddy; "/buddy compact" or "/buddy full" picks its size',
    })
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    const model = await $.session.model()
    const now = await $.clock.now()
    await update($, live, l => ({ ...l, model, lastActiveAt: now }))
    if ((await $.store.get(COMPACT_KEY)) === true) await update($, isCompact, () => true)

    $.clock.every(TICK_MS, () => {
      sinceDraw += TICK_MS
      if (sinceDraw >= pace) {
        sinceDraw = 0
        $.ui.invalidate('ui.render')
      }
    })

    return result
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'compact' || arg === 'full') {
      const small = arg === 'compact'
      await update($, isCompact, () => small)
      await update($, isHidden, () => false)
      await $.store.set(COMPACT_KEY, small)
      return { text: `buddy is ${arg} now.` }
    }
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    return { text: hidden ? 'buddy is hidden. Run /buddy to bring it back.' : 'buddy is back.' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e))

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, live, l => ({ ...l, turnStartedAt: now, lastActiveAt: now, toolsThisTurn: 0, doneUntil: 0, errorUntil: 0, activity: null }))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const current = activityOf(e.tool, input)
    const path = typeof input.file_path === 'string' ? input.file_path : undefined
    await update($, live, l => ({
      ...l,
      activity: current,
      toolsThisTurn: l.toolsThisTurn + 1,
      files: current.mood === 'editing' && path && !l.files.includes(path) ? [...l.files, path] : l.files,
    }))

    const result = await next(e)
    const failed = result.deny === undefined && result.isError === true
    const now = await $.clock.now()
    await update($, live, l => ({
      ...l,
      activity: l.activity === current || l.activity?.verb === current.verb ? null : l.activity,
      errorUntil: failed ? now + ERROR_MS : l.errorUntil,
    }))

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result // a subagent's turn, not ours

    const now = await $.clock.now()
    const model = await $.session.model()
    const usage = await $.session.usage()
    await update($, snapshot, () => toSnapshot(usage))
    const reading: Reading = { percent: usage.context.percent ?? 0, tokens: usage.context.tokens ?? 0 }
    await update($, readings, list => [...list, reading].slice(-HISTORY))
    await update($, live, l => ({
      ...l,
      activity: null,
      model,
      lastActiveAt: now,
      doneUntil: e.isAborted ? 0 : now + DONE_MS,
      lastTurn: { ms: now - l.turnStartedAt, tools: l.toolsThisTurn },
    }))

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null || (await read($, isHidden)) || e.props.maxRows < 2) {
      return next(e)
    }

    const l = await read($, live)
    const history = await read($, readings)
    const now = await $.clock.now()
    const isWorking = e.props.isWorking
    const percent = snap.percent ?? 0

    // What buddy is doing, and the line that says it.
    let mood: Mood
    const status: RenderElement[] = []
    const { Box, Button, Text } = $.ui.resolve(e)
    const dim = (text: string) => <Text dimColor>{text}</Text>
    const say = (m: Mood, word: string) => <Text color={MOOD_COLOR[m]} bold>{word}</Text>

    if (l.errorUntil > now) {
      mood = 'error'
      status.push(say(mood, 'oops'), dim(' that tool call failed'))
    } else if (isWorking) {
      mood = l.activity?.mood ?? 'thinking'
      status.push(say(mood, l.activity?.verb ?? 'thinking'))
      if (l.activity?.target) status.push(<Text> {shorten(l.activity.target, 32)}</Text>)
      status.push(dim(` · ${formatDuration(now - l.turnStartedAt)}`))
    } else if (l.doneUntil > now) {
      mood = 'done'
      status.push(say(mood, 'done'))
      if (l.lastTurn) status.push(dim(` in ${formatDuration(l.lastTurn.ms)} · ${l.lastTurn.tools} tool${l.lastTurn.tools === 1 ? '' : 's'}`))
    } else if (percent >= 90) {
      mood = 'full'
      status.push(say(mood, 'stuffed'), dim(' context nearly full, try /compact'))
    } else if (l.lastActiveAt > 0 && now - l.lastActiveAt > SLEEP_AFTER_MS) {
      mood = 'sleeping'
      status.push(say(mood, 'dozing'), dim(` · idle ${formatDuration(now - l.lastActiveAt)}`))
    } else {
      mood = 'idle'
      status.push(say(mood, 'ready'))
      if (l.lastTurn) status.push(dim(` · last turn ${formatDuration(l.lastTurn.ms)}`))
    }

    const columns = e.props.bodyColumns
    const isSmall = (await read($, isCompact)) || columns < TINY_COLUMNS || e.props.maxRows < Math.ceil(HEIGHT / 2)
    const isNarrow = columns < NARROW_COLUMNS
    const loop = animation(mood, { percent, isSweating: percent >= 75 && percent < 90 })
    pace = e.surface === 'terminal' ? loop.frameMs : 1000

    // Context: a sparkline of past turns, then now.
    const isMeasured = snap.percent !== undefined
    const sparks = isMeasured ? [...history.slice(isNarrow ? -6 : -12).map(r => r.percent), percent] : []
    const context: RenderElement[] = [dim('ctx ')]
    for (const p of sparks) context.push(<Text color={levelColor(p)}>{spark(p)}</Text>)
    context.push(isMeasured ? <Text color={levelColor(percent)} bold> {percent}%</Text> : dim('measured after the first turn'))
    if (!isNarrow && snap.tokens !== undefined) context.push(dim(` ${formatTokens(snap.tokens)}/${formatTokens(snap.window)}`))
    const last = history.at(-1)
    const before = history.at(-2)
    if (!isNarrow && last && before && last.tokens !== before.tokens) {
      const delta = last.tokens - before.tokens
      context.push(<Text color={delta > 0 ? undefined : '#7BC96F'} dimColor={delta > 0}> {delta > 0 ? '▲' : '▼'}{formatTokens(Math.abs(delta))}</Text>)
    }

    const limit = (one: Limit, cellsWide: number) => {
      const { filled, empty } = meter(one.percentUsed, cellsWide)
      const out: RenderElement[] = [dim(`${LIMIT_LABELS[one.kind] ?? one.kind} `)]
      if (cellsWide > 0) out.push(<Text color={levelColor(one.percentUsed)}>{filled}</Text>, dim(empty), <Text> </Text>)
      out.push(<Text color={levelColor(one.percentUsed)}>{one.percentUsed}%</Text>)
      if (!isNarrow && one.resetsAt) out.push(dim(` resets ${formatUntil(one.resetsAt, now)}`))
      return out
    }

    const toggle = (
      <Button key="size" label={isSmall ? 'expand' : 'compact'} plain dimColor onPress={async () => {
        const small = !isSmall
        await update($, isCompact, () => small)
        await $.store.set(COMPACT_KEY, small)
      }} />
    )
    // The terminal draws its own [-] in the band's corner; elsewhere buddy offers hide.
    const isTerminal = e.surface === 'terminal'
    const controls = (
      <Box key="controls" marginRight={isTerminal ? 4 : 0}>
        {toggle}
        {isTerminal ? null : <Text> </Text>}
        {isTerminal ? null : <Button key="hide" label="hide" plain dimColor onPress={() => update($, isHidden, () => true)} />}
      </Box>
    )
    const line = (key: string, parts: RenderElement[], withControls = false) => (
      <Box key={key}>
        {parts}
        {withControls ? <Box flexGrow={1} /> : null}
        {withControls ? controls : null}
      </Box>
    )

    const art = (() => {
      const grid = frameAt(loop, now)
      const crop = isSmall ? FACE : undefined
      if (isTerminal) {
        const { Raster } = $.ui.resolve(e)
        const columnsWide = crop?.width ?? WIDTH
        const rowsTall = Math.ceil((crop?.height ?? HEIGHT) / 2)
        return <Raster key="buddy" columns={columnsWide} rows={rowsTall} cells={cells(grid, crop)} />
      }
      const { Svg } = $.ui.resolve(e)
      const source = svg(loop, DESKTOP_SCALE, crop)
      const widthPx = (crop?.width ?? WIDTH) * DESKTOP_SCALE
      const heightPx = (crop?.height ?? HEIGHT) * DESKTOP_SCALE
      return <Svg source={source} alt={`buddy is ${mood}`} width={widthPx} height={heightPx} isInteractive />
    })()

    if (isSmall) {
      const five = snap.limits.find(one => one.kind === 'five_hour')
      const stats: RenderElement[] = [...context.slice(0, 1 + sparks.length + 1)]
      if (five) stats.push(dim('  '), ...limit(five, 0))
      if (snap.usd !== undefined) stats.push(dim(`  $${snap.usd.toFixed(2)}`))
      return (
        <Box alignItems="center">
          {art}
          <Box flexDirection="column" flexGrow={1} marginLeft={1}>
            {line('status', status, true)}
            {line('stats', stats)}
          </Box>
        </Box>
      )
    }

    const limits: RenderElement[] = []
    for (const one of snap.limits) {
      if (limits.length > 0) limits.push(dim('   '))
      limits.push(...limit(one, isNarrow ? 5 : 8))
    }
    if (limits.length === 0) limits.push(dim('no usage limits reported'))

    const extras: RenderElement[] = []
    if (snap.usd !== undefined) extras.push(<Text>${snap.usd.toFixed(2)}</Text>)
    if (isWorking && l.toolsThisTurn > 0) extras.push(dim(`${extras.length ? ' · ' : ''}${l.toolsThisTurn} tools`))
    if (l.files.length > 0) extras.push(dim(`${extras.length ? ' · ' : ''}${l.files.length} file${l.files.length === 1 ? '' : 's'} edited`))
    if (l.model && !isNarrow) extras.push(dim(`${extras.length ? ' · ' : ''}${l.model.replace(/^claude-/, '')}`))

    return (
      <Box alignItems="center">
        {art}
        <Box flexDirection="column" flexGrow={1} marginLeft={2}>
          {line('status', status, true)}
          {line('context', context)}
          {line('limits', limits)}
          {line('extras', extras)}
        </Box>
      </Box>
    )
  })
}
