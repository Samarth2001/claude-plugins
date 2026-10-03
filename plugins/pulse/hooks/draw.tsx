// What pulse draws: the glance row, the tab bodies and the dashboard pane.
// Every function takes the surface's element table and plain data, so the
// band and the pane share one set of rows.

import type { ElementTable, RenderElement } from 'claude-code'

import type { Ledger, Limit, Live, Range, Snapshot, Tab, Turn, View } from '../types'
import {
  LIMIT_LABELS,
  addDays,
  cacheHit,
  columns,
  ekg,
  forecast,
  formatDuration,
  formatSpan,
  formatTokens,
  formatUsd,
  levelColor,
  meter,
  pace,
  paceColor,
  series,
  shortDate,
  shorten,
  spark,
  summarize,
} from './calc'

export type Ui = Pick<ElementTable, 'Box' | 'Text' | 'Button'>

export type Data = {
  snap: Snapshot
  turns: Turn[]
  live: Live
  ledger: Ledger
  view: View
  now: number
  today: string
}

export type Actions = {
  setView: (change: Partial<View>) => void
  openPane: () => void
}

export const ACCENT = '#B4A7F5'
const BAR = '#7FB2F0'
const GOOD = '#7BC96F'
const FRAME_MS = 140

export const TABS: { tab: Tab; label: string; hotkey: string }[] = [
  { tab: 'context', label: 'Context', hotkey: '1' },
  { tab: 'limits', label: 'Limits', hotkey: '2' },
  { tab: 'cost', label: 'Cost', hotkey: '3' },
  { tab: 'turns', label: 'Turns', hotkey: '4' },
]

const RANGES: { range: Range; label: string; hotkey: string }[] = [
  { range: 'week', label: '7d', hotkey: 'w' },
  { range: 'month', label: '30d', hotkey: 'm' },
  { range: 'year', label: '12mo', hotkey: 'y' },
]

// A little text toolkit over one element table.
function kit(ui: Ui) {
  const { Box, Text } = ui
  return {
    dim: (text: string) => <Text dimColor>{text}</Text>,
    plain: (text: string) => <Text>{text}</Text>,
    paint: (text: string, color: string, bold = false) => <Text color={color} bold={bold}>{text}</Text>,
    // A value that just changed glows for a moment: the live-update cue.
    live: (text: string, color: string | undefined, isFlashing: boolean) => (
      <Text color={color} bold inverse={isFlashing}>{text}</Text>
    ),
    row: (key: string, parts: RenderElement[]) => <Box key={key} overflow="hidden">{parts}</Box>,
  }
}

function meterParts(ui: Ui, limit: Limit, cells: number, now: number): RenderElement[] {
  const { Text } = ui
  const p = pace(limit, now)
  const color = paceColor(limit, p)
  const { filled, empty, markAt } = meter(limit.percentUsed, cells, p?.expected)
  const bar = filled + empty
  if (markAt === undefined) return [<Text color={color}>{filled}</Text>, <Text dimColor>{empty}</Text>]
  // Split the bar around the even-pace mark.
  const before = bar.slice(0, markAt)
  const after = bar.slice(markAt + 1)
  const split = (text: string, offset: number) => {
    const n = Math.max(0, Math.min(text.length, filled.length - offset))
    return [<Text color={color}>{text.slice(0, n)}</Text>, <Text dimColor>{text.slice(n)}</Text>]
  }
  return [...split(before, 0), <Text color={markAt < filled.length ? color : undefined} bold>┃</Text>, ...split(after, markAt + 1)]
}

// One line, always: what is happening and the four numbers that matter.
export function glance(ui: Ui, d: Data, width: number, actions: Actions, isPane = false): RenderElement {
  const { Box, Button } = ui
  const t = kit(ui)
  const { snap, live, now } = d
  const isWide = width >= 120
  const isMid = width >= 84
  const sep = t.dim('  │  ')
  const parts: RenderElement[] = []

  // The heartbeat, then the turn's clock while working.
  const frame = Math.floor(now / FRAME_MS)
  parts.push(<ui.Text color={live.isWorking ? ACCENT : undefined} dimColor={!live.isWorking}>{ekg(frame, isMid ? 6 : 3, live.isWorking)}</ui.Text>)
  if (live.isWorking) {
    parts.push(t.plain(` ${formatDuration(now - live.turnStartedAt)}`))
    if (isWide && live.toolsThisTurn > 0) parts.push(t.dim(` · ${live.toolsThisTurn} tool${live.toolsThisTurn === 1 ? '' : 's'}`))
  } else {
    parts.push(t.dim(' idle'))
  }

  // Context.
  parts.push(sep, t.dim('ctx '))
  const percent = snap.percent
  if (percent === undefined) {
    parts.push(t.dim('after the first turn'))
  } else {
    if (isMid) {
      const history = d.turns.slice(isWide ? -8 : -4).map(turn => turn.percent)
      for (const p of history) parts.push(t.paint(spark(p), levelColor(p)))
      if (history.length > 0) parts.push(t.plain(' '))
    }
    parts.push(t.live(`${percent}%`, levelColor(percent), live.flash.context > now))
  }

  // Plan limits, each with a meter on wide screens.
  const flashLimits = live.flash.limits > now
  for (const limit of snap.limits) {
    parts.push(sep, t.dim(`${LIMIT_LABELS[limit.kind] ?? limit.kind} `))
    if (isWide) parts.push(...meterParts(ui, limit, 6, now), t.plain(' '))
    parts.push(t.live(`${Math.round(limit.percentUsed)}%`, paceColor(limit, pace(limit, now)), flashLimits))
    if (isMid && limit.kind === 'five_hour' && limit.resetsAt) {
      parts.push(t.dim(` ↻${formatSpan(Date.parse(limit.resetsAt) - now)}`))
    }
  }

  // Money: this session, then today and this month across sessions.
  if (snap.usd !== undefined) {
    const spend = summarize(d.ledger, d.today)
    parts.push(sep, t.live(formatUsd(snap.usd), undefined, live.flash.cost > now))
    if (isMid) parts.push(t.dim(' · today '), t.plain(formatUsd(spend.today)))
    if (isWide) parts.push(t.dim(` · ${spend.monthLabel} `), t.plain(formatUsd(spend.month)))
  }

  const isDetail = d.view.mode === 'detail'
  return (
    <Box key="glance">
      <Box flexGrow={1} overflow="hidden">{parts}</Box>
      {isPane ? null : (
        <Button key="expand" label={isDetail ? '▴ less' : '▾ more'} hotkey="e" plain dimColor
          onPress={() => actions.setView({ mode: isDetail ? 'glance' : 'detail' })} />
      )}
    </Box>
  )
}

// The tab strip under the glance row: tabs left, range and pane right.
export function tabBar(ui: Ui, d: Data, actions: Actions, isTerminal: boolean): RenderElement {
  const { Box, Button, Text } = ui
  const tabs = TABS.map(({ tab, label, hotkey }) => (
    <Box key={`tab-${tab}`} marginRight={2}>
      <Text color={d.view.tab === tab ? ACCENT : undefined}>{d.view.tab === tab ? '▸' : ' '}</Text>
      <Button key={tab} label={label} hotkey={hotkey} plain dimColor={d.view.tab !== tab} onPress={() => actions.setView({ tab })} />
    </Box>
  ))
  const ranges = d.view.tab === 'cost' ? rangeButtons(ui, d, actions) : null
  return (
    <Box key="tabs">
      {tabs}
      <Box flexGrow={1} />
      {ranges}
      <Button key="pane" label="dashboard" hotkey="p" plain dimColor onPress={actions.openPane} />
      {isTerminal ? <Box marginRight={4} /> : (
        <Box marginLeft={2}>
          <Button key="hide" label="hide" plain dimColor onPress={() => actions.setView({ mode: 'hidden' })} />
        </Box>
      )}
    </Box>
  )
}

function rangeButtons(ui: Ui, d: Data, actions: Actions): RenderElement {
  const { Box, Button } = ui
  return (
    <Box key="ranges" marginRight={2}>
      {RANGES.map(({ range, label, hotkey }) => (
        <Box key={`range-${range}`} marginRight={1}>
          <Button key={range} label={label} hotkey={hotkey} plain dimColor={d.view.range !== range} onPress={() => actions.setView({ range })} />
        </Box>
      ))}
    </Box>
  )
}

export function body(ui: Ui, d: Data, tab: Tab, width: number, rows: number): RenderElement[] {
  if (rows <= 0) return []
  switch (tab) {
    case 'context':
      return contextRows(ui, d, width, rows)
    case 'limits':
      return limitRows(ui, d, width, rows)
    case 'cost':
      return costRows(ui, d, width, rows)
    case 'turns':
      return turnRows(ui, d, width, rows)
  }
}

function contextRows(ui: Ui, d: Data, width: number, rows: number): RenderElement[] {
  const t = kit(ui)
  const { snap, turns, live, now } = d
  if (snap.percent === undefined) return [t.row('ctx-none', [t.dim('Context is measured after the first response.')])]

  const out: RenderElement[] = []
  const history = turns.slice(-Math.max(4, Math.min(32, width - 60)))
  const first: RenderElement[] = []
  for (const turn of history) first.push(t.paint(spark(turn.percent), levelColor(turn.percent)))
  if (history.length > 0) first.push(t.plain('  '))
  first.push(t.live(`${snap.percent}%`, levelColor(snap.percent), live.flash.context > now))
  if (snap.tokens !== undefined) first.push(t.dim(`  ${formatTokens(snap.tokens)} of ${formatTokens(snap.window)} tokens`))
  const last = turns.at(-1)
  const before = turns.at(-2)
  if (last && before && last.tokens !== before.tokens) {
    const delta = last.tokens - before.tokens
    first.push(t.dim('  last turn '), t.paint(`${delta > 0 ? '▲' : '▼'}${formatTokens(Math.abs(delta))}`, delta > 0 ? levelColor(snap.percent) : GOOD))
  }
  out.push(t.row('ctx-1', first))

  const second: RenderElement[] = []
  const f = forecast(turns.map(turn => turn.tokens), snap.window)
  if (f) {
    second.push(t.dim('avg '), t.plain(`+${formatTokens(f.perTurn)}`), t.dim(' per turn'))
    if (f.turnsLeft !== undefined) second.push(t.dim(' · '), t.paint(`~${f.turnsLeft} turns`, levelColor(snap.percent)), t.dim(' to full'))
  } else {
    second.push(t.dim('a forecast shows after two turns'))
  }
  const hit = last?.cacheHit
  if (hit !== undefined) second.push(t.dim(' · cache '), t.paint(`${hit}%`, hit >= 70 ? GOOD : levelColor(100 - hit)), t.dim(' last turn'))
  out.push(t.row('ctx-2', second))

  const third: RenderElement[] = []
  if (live.model) third.push(t.plain(live.model.replace(/^claude-/, '')), t.dim(' · '))
  third.push(t.dim(`${turns.length} turn${turns.length === 1 ? '' : 's'}`))
  if (snap.percent >= 80) third.push(t.dim(' · '), t.paint('/compact soon', levelColor(snap.percent)))
  out.push(t.row('ctx-3', third))
  return out.slice(0, rows)
}

function limitRows(ui: Ui, d: Data, width: number, rows: number): RenderElement[] {
  const t = kit(ui)
  const { snap, now } = d
  if (snap.limits.length === 0) {
    return [t.row('limits-none', [t.dim('No plan limits reported yet. They show after a response on a subscription.')])]
  }
  const cells = Math.max(8, Math.min(30, width - 70))
  const out: RenderElement[] = []
  let hasMark = false
  for (const limit of snap.limits) {
    const p = pace(limit, now)
    if (p) hasMark = true
    const color = paceColor(limit, p)
    const parts: RenderElement[] = [t.dim(`${(LIMIT_LABELS[limit.kind] ?? limit.kind).padEnd(5)} `)]
    parts.push(...meterParts(ui, limit, cells, now))
    parts.push(t.plain('  '), t.live(`${Math.round(limit.percentUsed)}%`.padStart(4), color, d.live.flash.limits > now))
    if (limit.resetsAt) parts.push(t.dim(`  resets in ${formatSpan(Date.parse(limit.resetsAt) - now)}`))
    if (p) {
      parts.push(t.dim('  ·  '), t.paint(`${p.ratio.toFixed(1)}x`, color), t.dim(' pace'))
      if (p.fullInMs !== undefined) parts.push(t.dim(' · '), t.paint(`full in ~${formatSpan(p.fullInMs)}`, '#E5534B', true))
      else parts.push(t.dim(' → '), t.paint(`${Math.round(p.atReset)}%`, color), t.dim(' at reset'))
    }
    out.push(t.row(`limit-${limit.kind}`, parts))
  }
  if (hasMark && out.length < rows) out.push(t.row('limits-legend', [t.dim('┃ marks an even pace through the window')]))
  return out.slice(0, rows)
}

function costRows(ui: Ui, d: Data, width: number, rows: number): RenderElement[] {
  const { Box, Text } = ui
  const t = kit(ui)
  const { snap, ledger, live, today } = d
  const spend = summarize(ledger, today)

  // Bars for the chosen range, two rows tall, with labels under them.
  const buckets = series(ledger, today, d.view.range)
  const peak = Math.max(...buckets.map(b => b.usd), 0)
  const barWidth = d.view.range === 'month' ? 1 : 2
  const gap = d.view.range === 'month' ? '' : ' '
  const grid = columns(buckets.map(b => (peak > 0 ? b.usd / peak : 0)), 2)
  const chartRow = (r: number) => (
    <Box key={`chart-${r}`}>
      {buckets.map((b, i) => (
        <Text color={b.isNow ? ACCENT : BAR}>{(grid[r]?.[i] ?? ' ').repeat(barWidth)}{gap}</Text>
      ))}
    </Box>
  )
  const labels = d.view.range === 'month'
    ? <Text dimColor>{shortDate(addDays(today, -29)).padEnd(buckets.length - 5)}today</Text>
    : <Text dimColor>{buckets.map(b => b.label.padEnd(barWidth).slice(0, barWidth) + gap).join('')}</Text>
  const peakNote = peak > 0 ? t.dim(` peak ${formatUsd(peak)}`) : t.dim(' nothing spent yet')

  const stats: RenderElement[] = [
    t.row('cost-1', [
      t.dim('session '), t.live(formatUsd(snap.usd ?? 0), undefined, live.flash.cost > d.now),
      t.dim('  today '), t.plain(formatUsd(spend.today)),
      t.dim('  7d '), t.plain(formatUsd(spend.week)),
    ]),
    t.row('cost-2', [
      t.dim(`${spend.monthLabel} `), t.paint(formatUsd(spend.month), ACCENT, true),
      t.dim('  → '), t.plain(`~${formatUsd(spend.monthForecast)}`), t.dim(' by month end'),
      spend.lastMonth > 0 ? t.dim(`  last month ${formatUsd(spend.lastMonth)}`) : t.dim(''),
    ]),
    t.row('cost-3', [
      t.dim('avg '), t.plain(formatUsd(spend.perDay)), t.dim('/day'),
      spend.since ? t.dim(`  · tracked here since ${shortDate(spend.since)}`) : t.dim(''),
    ]),
  ]

  const tokens = live.tokens
  const counted = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite
  const tokenRow = counted > 0
    ? t.row('cost-tokens', [
        t.dim('tokens in '), t.plain(formatTokens(tokens.input + tokens.cacheRead + tokens.cacheWrite)),
        t.dim(' · out '), t.plain(formatTokens(tokens.output)),
        t.dim(' · cache hit '), t.plain(`${cacheHit({ input_tokens: tokens.input, cache_read_input_tokens: tokens.cacheRead, cache_creation_input_tokens: tokens.cacheWrite }) ?? 0}%`),
        tokens.subagent > 0 ? t.dim(` · subagents ${Math.round((tokens.subagent / counted) * 100)}%`) : t.dim(''),
      ])
    : null

  const chartWidth = buckets.length * (barWidth + gap.length)
  if (width >= chartWidth + 50) {
    // Chart left, totals right.
    const out: RenderElement[] = [
      <Box key="cost-side">
        <Box flexDirection="column" marginRight={3}>
          {chartRow(0)}
          {chartRow(1)}
          <Box>{labels}</Box>
        </Box>
        <Box flexDirection="column">{rows >= 3 ? stats : stats.slice(0, rows)}</Box>
      </Box>,
    ]
    if (tokenRow && rows >= 4) out.push(tokenRow)
    return out
  }
  // Narrow: totals first, the chart if it fits.
  const out: RenderElement[] = [...stats.slice(0, 2)]
  if (rows >= 5) out.push(<Box key="cost-chart">{chartRow(0)}</Box>, <Box key="cost-chart-2">{chartRow(1)}{peakNote}</Box>, <Box key="cost-labels">{labels}</Box>)
  return out.slice(0, rows)
}

function turnRows(ui: Ui, d: Data, width: number, rows: number): RenderElement[] {
  const t = kit(ui)
  const { turns, live } = d
  const out: RenderElement[] = []
  const shown = turns.slice(-Math.max(1, rows - 1)).reverse()
  if (shown.length === 0) out.push(t.row('turns-none', [t.dim('Turns show here as they finish.')]))
  const longest = Math.max(...shown.map(turn => turn.ms), 1)
  const cells = width >= 100 ? 10 : 6
  for (const [i, turn] of shown.entries()) {
    const previous = turns[turns.length - 1 - i - 1]
    const grew = previous ? turn.tokens - previous.tokens : 0
    const filled = Math.max(1, Math.round((turn.ms / longest) * cells))
    const parts: RenderElement[] = [
      t.dim(`#${String(turn.n).padEnd(4)}`),
      t.plain(formatDuration(turn.ms).padStart(6)),
      t.plain(' '),
      t.paint('▇'.repeat(filled), turn.isAborted ? '#E8964A' : BAR),
      t.dim('·'.repeat(cells - filled)),
      t.dim(`  ${String(turn.tools).padStart(2)} tool${turn.tools === 1 ? ' ' : 's'}`),
    ]
    if (grew !== 0) parts.push(t.dim(`  ${grew > 0 ? '+' : '-'}${formatTokens(Math.abs(grew))} ctx`))
    if (turn.usd !== undefined) parts.push(t.dim('  '), t.plain(formatUsd(turn.usd)))
    if (turn.cacheHit !== undefined && width >= 90) parts.push(t.dim(`  cache ${turn.cacheHit}%`))
    if (turn.isAborted) parts.push(t.paint('  interrupted', '#E8964A'))
    out.push(t.row(`turn-${turn.n}`, parts))
  }

  const mix = Object.entries(live.tools).sort((a, b) => b[1] - a[1])
  if (mix.length > 0) {
    const parts: RenderElement[] = [t.dim('tools ')]
    for (const [i, [tool, count]] of mix.slice(0, width >= 100 ? 8 : 4).entries()) {
      if (i > 0) parts.push(t.dim(' · '))
      parts.push(t.plain(shorten(tool, 14)), t.dim(` ${count}`))
    }
    out.push(t.row('turns-tools', parts))
  }
  return out.slice(0, rows)
}

// The dashboard: every section at once, for the side pane.
export function dashboard(ui: Ui, d: Data, width: number, actions: Actions): RenderElement {
  const { Box, Text } = ui
  const heading = (key: string, label: string, extra?: RenderElement | null) => (
    <Box key={key} marginTop={1}>
      <Text color={ACCENT} bold>{label}</Text>
      <Box flexGrow={1} />
      {extra ?? null}
    </Box>
  )
  return (
    <Box flexDirection="column">
      {glance(ui, d, width, actions, true)}
      {heading('h-context', 'Context')}
      {body(ui, d, 'context', width, 3)}
      {heading('h-limits', 'Plan limits')}
      {body(ui, d, 'limits', width, 4)}
      {heading('h-cost', 'Spend', rangeButtons(ui, d, actions))}
      {body(ui, d, 'cost', width, 6)}
      {heading('h-turns', 'Recent turns')}
      {body(ui, d, 'turns', width, 9)}
    </Box>
  )
}
