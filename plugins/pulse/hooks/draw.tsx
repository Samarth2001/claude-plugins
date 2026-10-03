// What pulse draws. The band is one row; pressing a label opens one drawer row
// under it with that metric's detail. The pane shows every drawer, larger.

import type { RenderElement } from 'claude-code'

import type { Ledger, Limit, Live, Range, Snapshot, Tab, Turn, View } from '../types'
import {
  LIMIT_LABELS,
  addDays,
  cacheHit,
  forecast,
  formatDuration,
  formatSpan,
  formatTokens,
  formatUsd,
  heat,
  levelColor,
  monthName,
  pace,
  paceColor,
  series,
  shortDate,
  shorten,
  summarize,
} from './calc'
import { ACCENT, area, bar, columns, ring, timeline, wave } from './widgets'
import type { Surface } from './widgets'

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

export { ACCENT }
const GOOD = '#7BC96F'
const WARN = '#E8964A'
const FRAME_MS = 140

const RANGES: { range: Range; label: string }[] = [
  { range: 'week', label: '7d' },
  { range: 'month', label: '30d' },
  { range: 'year', label: '12mo' },
]

function kit(s: Surface) {
  const { Box, Text } = s.ui
  return {
    dim: (text: string) => <Text dimColor>{text}</Text>,
    plain: (text: string) => <Text>{text}</Text>,
    paint: (text: string, color: string, bold = false) => <Text color={color} bold={bold}>{text}</Text>,
    // A value that just changed glows for a moment.
    live: (text: string, color: string | undefined, isFlashing: boolean) => (
      <Text color={color} bold inverse={isFlashing}>{text}</Text>
    ),
    row: (key: string, parts: RenderElement[]) => <Box key={key} alignItems="center" overflow="hidden">{parts}</Box>,
    gap: (n: number) => <Text>{' '.repeat(n)}</Text>,
  }
}

const isFlashing = (d: Data, unit: keyof Live['flash']) => d.live.flash[unit] > d.now

// A label that opens its drawer, or closes it when it is the open one.
function label(s: Surface, d: Data, actions: Actions, tab: Tab, text: string): RenderElement {
  const { Button } = s.ui
  const isOpen = d.view.mode === 'detail' && d.view.tab === tab
  return (
    <Button key={`open-${tab}-${text}`} label={text} plain dimColor={!isOpen}
      onPress={() => actions.setView(isOpen ? { mode: 'glance' } : { mode: 'detail', tab })} />
  )
}

// The one row: heartbeat, context, each plan limit, money.
export function glance(s: Surface, d: Data, width: number, actions: Actions, isPane = false): RenderElement {
  const { Box, Button } = s.ui
  const t = kit(s)
  const { snap, live, now } = d
  const isWide = width >= 120
  const isMid = width >= 84
  const space = isWide ? 3 : isMid ? 2 : 1
  const parts: RenderElement[] = []
  const between = () => parts.push(t.gap(space))

  // Heartbeat and the turn's clock.
  parts.push(wave(s, live.isWorking, Math.floor(now / FRAME_MS), isMid ? 6 : 3), t.gap(1))
  if (live.isWorking) {
    parts.push(t.paint(formatDuration(now - live.turnStartedAt), ACCENT))
    if (isWide && live.toolsThisTurn > 0) parts.push(t.dim(` · ${live.toolsThisTurn} tool${live.toolsThisTurn === 1 ? '' : 's'}`))
  } else {
    parts.push(label(s, d, actions, 'turns', isMid ? 'idle' : '·'))
  }

  // Context.
  between()
  parts.push(label(s, d, actions, 'context', 'ctx'), t.gap(1))
  if (snap.percent === undefined) {
    parts.push(t.dim('—'))
  } else {
    if (isMid) {
      const gauge = s.isTerminal && isWide
        ? area(s, 'ctx-spark', [...d.turns.map(x => x.percent), snap.percent].slice(-6), 6)
        : ring(s, snap.percent, isFlashing(d, 'context') ? live.previous.percent : undefined)
      parts.push(gauge, t.gap(1))
    }
    parts.push(t.live(`${snap.percent}%`, levelColor(snap.percent), isFlashing(d, 'context')))
  }

  // Plan limits.
  for (const limit of snap.limits) {
    const p = pace(limit, now)
    between()
    parts.push(label(s, d, actions, 'limits', LIMIT_LABELS[limit.kind] ?? limit.kind), t.gap(1))
    if (isMid) {
      const from = isFlashing(d, 'limits') ? live.previous.limits[limit.kind] : undefined
      parts.push(bar(s, `bar-${limit.kind}`, limit.percentUsed, isWide ? 8 : 5, p?.expected, from), t.gap(1))
    }
    parts.push(t.live(`${Math.round(limit.percentUsed)}%`, paceColor(limit, p), isFlashing(d, 'limits')))
    if (isWide && limit.kind === 'five_hour' && limit.resetsAt) parts.push(t.dim(` ↻${formatSpan(Date.parse(limit.resetsAt) - now)}`))
  }

  // Money.
  if (snap.usd !== undefined) {
    const spend = summarize(d.ledger, d.today)
    between()
    parts.push(label(s, d, actions, 'cost', isMid ? 'cost' : '$'), t.gap(1), t.live(formatUsd(snap.usd), undefined, isFlashing(d, 'cost')))
    if (isWide) parts.push(t.dim(` · ${spend.monthLabel} `), t.plain(formatUsd(spend.month)))
  }

  const isOpen = d.view.mode === 'detail'
  return (
    <Box key="glance" alignItems="center">
      <Box flexGrow={1} alignItems="center" overflow="hidden">{parts}</Box>
      {isPane ? null : (
        <Box marginLeft={2}>
          <Button key="expand" label={isOpen ? '▴' : '▾'} plain dimColor onPress={() => actions.setView({ mode: isOpen ? 'glance' : 'detail' })} />
        </Box>
      )}
    </Box>
  )
}

// The open drawer's rows, at most two, under the glance row.
export function drawer(s: Surface, d: Data, width: number, actions: Actions): RenderElement[] {
  const { Box, Button, Text } = s.ui
  const rows = section(s, d, d.view.tab, width, actions, false)
  // The terminal draws its own [-] in the band's corner; elsewhere, hide.
  const controls = (
    <Box key="drawer-controls" marginLeft={2}>
      <Button key="pane" label="⤢" plain dimColor onPress={actions.openPane} />
      {s.isTerminal ? null : <Box marginLeft={1}><Button key="hide" label="hide" plain dimColor onPress={() => actions.setView({ mode: 'hidden' })} /></Box>}
    </Box>
  )
  return rows.map((row, i) => (
    <Box key={`drawer-${i}`} alignItems="center">
      {s.isTerminal ? <Text dimColor>{i === rows.length - 1 ? '╰ ' : '│ '}</Text> : null}
      <Box flexGrow={1} overflow="hidden">{row}</Box>
      {i === 0 ? controls : null}
    </Box>
  ))
}

// One metric's detail. In the band each section is one or two rows; in the
// pane (`big`) it takes more room and taller charts.
export function section(s: Surface, d: Data, tab: Tab, width: number, actions: Actions, big: boolean): RenderElement[] {
  switch (tab) {
    case 'context':
      return contextRows(s, d, width, big)
    case 'limits':
      return limitRows(s, d, width, big)
    case 'cost':
      return costRows(s, d, width, actions, big)
    case 'turns':
      return turnRows(s, d, width, big)
  }
}

function contextRows(s: Surface, d: Data, width: number, big: boolean): RenderElement[] {
  const t = kit(s)
  const { snap, turns, live } = d
  if (snap.percent === undefined) return [t.row('ctx', [t.dim('Context is measured after the first response.')])]
  const history = [...turns.map(x => x.percent), snap.percent]
  const parts: RenderElement[] = [
    area(s, 'ctx-area', history, big ? 40 : width >= 120 ? 24 : 12), t.gap(2),
    t.live(`${snap.percent}%`, levelColor(snap.percent), isFlashing(d, 'context')),
  ]
  if (snap.tokens !== undefined) parts.push(t.dim(`  ${formatTokens(snap.tokens)} of ${formatTokens(snap.window)} tokens`))
  const last = turns.at(-1)
  const before = turns.at(-2)
  if (last && before && last.tokens !== before.tokens) {
    const delta = last.tokens - before.tokens
    parts.push(t.gap(2), t.paint(`${delta > 0 ? '▲' : '▼'}${formatTokens(Math.abs(delta))}`, delta > 0 ? levelColor(snap.percent) : GOOD), t.dim(' last turn'))
  }
  const second: RenderElement[] = []
  const f = forecast(turns.map(x => x.tokens), snap.window)
  if (f) {
    second.push(t.dim('+'), t.plain(formatTokens(f.perTurn)), t.dim('/turn'))
    if (f.turnsLeft !== undefined) second.push(t.dim(' · '), t.paint(`~${f.turnsLeft}`, levelColor(snap.percent)), t.dim(' turns left'))
  }
  if (last?.cacheHit !== undefined) second.push(t.dim(second.length ? ' · cache ' : 'cache '), t.paint(`${last.cacheHit}%`, last.cacheHit >= 70 ? GOOD : WARN))
  if (live.model) second.push(t.dim(`${second.length ? ' · ' : ''}${live.model.replace(/^claude-/, '')}`))
  if (snap.percent >= 80) second.push(t.dim(' · '), t.paint('/compact soon', levelColor(snap.percent)))
  if (big || width < 150) return [t.row('ctx-1', parts), t.row('ctx-2', second)]
  return [t.row('ctx-1', [...parts, t.dim('   '), ...second])]
}

function limitRow(s: Surface, d: Data, limit: Limit, cols: number): RenderElement[] {
  const t = kit(s)
  const p = pace(limit, d.now)
  const color = paceColor(limit, p)
  const from = isFlashing(d, 'limits') ? d.live.previous.limits[limit.kind] : undefined
  const parts: RenderElement[] = [
    t.dim((LIMIT_LABELS[limit.kind] ?? limit.kind).padEnd(3)), t.gap(1),
    bar(s, `wide-${limit.kind}`, limit.percentUsed, cols, p?.expected, from), t.gap(2),
    t.live(`${Math.round(limit.percentUsed)}%`, color, isFlashing(d, 'limits')),
  ]
  if (p) {
    parts.push(t.dim('  '), t.paint(`${p.ratio.toFixed(1)}×`, color), t.dim(' pace'))
    if (p.fullInMs !== undefined) parts.push(t.dim(' · '), t.paint(`full in ~${formatSpan(p.fullInMs)}`, '#E5534B', true))
    else parts.push(t.dim(' → '), t.paint(`${Math.round(p.atReset)}%`, color), t.dim(' at reset'))
  }
  if (limit.resetsAt) parts.push(t.dim(`  ↻ ${formatSpan(Date.parse(limit.resetsAt) - d.now)}`))
  return parts
}

function limitRows(s: Surface, d: Data, width: number, big: boolean): RenderElement[] {
  const t = kit(s)
  if (d.snap.limits.length === 0) return [t.row('limits', [t.dim('No plan limits yet. They show after a response on a subscription.')])]
  // Both windows share one row when there is room for two.
  const [a, b] = d.snap.limits
  if (!big && width >= 170 && a && b && d.snap.limits.length === 2) {
    return [t.row('limits', [...limitRow(s, d, a, 14), t.dim('     '), ...limitRow(s, d, b, 14)])]
  }
  const cols = big ? 40 : width >= 120 ? 20 : 10
  const rows = d.snap.limits.map(limit => t.row(`limit-${limit.kind}`, limitRow(s, d, limit, cols)))
  if (big) rows.push(t.row('limits-legend', [t.paint('┃', ACCENT), t.dim(' where an even pace would be by now')]))
  return rows
}

function rangeButtons(s: Surface, d: Data, actions: Actions): RenderElement {
  const { Box, Button } = s.ui
  return (
    <Box key="ranges" flexShrink={0}>
      {RANGES.map(({ range, label: text }) => (
        <Box key={`range-${range}`} marginRight={1}>
          <Button key={range} label={text} plain dimColor={d.view.range !== range} onPress={() => actions.setView({ range })} />
        </Box>
      ))}
    </Box>
  )
}

function costRows(s: Surface, d: Data, width: number, actions: Actions, big: boolean): RenderElement[] {
  const { Box, Text } = s.ui
  const t = kit(s)
  const { snap, ledger, live, today } = d
  const spend = summarize(ledger, today)
  const buckets = series(ledger, today, d.view.range)
  const shape = d.view.range === 'month' ? { w: 1, gap: 0 } : { w: 2, gap: 1 }
  // A month of days labels every fifth bar so the numbers don't collide.
  const labels = buckets.map((b, i) => (d.view.range !== 'month' || i % 5 === 4 ? b.label : ''))
  const chart = columns(s, `chart-${d.view.range}`, buckets.map(b => b.usd), shape.w, shape.gap, big ? 3 : 1, big && !s.isTerminal ? labels : undefined)

  const totals: RenderElement[] = [
    t.dim('today '), t.plain(formatUsd(spend.today)),
    t.dim(' · 7d '), t.plain(formatUsd(spend.week)),
    t.dim(` · ${spend.monthLabel} `), t.paint(formatUsd(spend.month), ACCENT, true),
    t.dim(' → '), t.plain(`~${formatUsd(spend.monthForecast)}`),
  ]
  const more: RenderElement[] = [
    t.dim('session '), t.live(formatUsd(snap.usd ?? 0), undefined, isFlashing(d, 'cost')),
    t.dim(' · avg '), t.plain(formatUsd(spend.perDay)), t.dim('/day'),
  ]
  if (spend.lastMonth > 0) more.push(t.dim(` · ${monthName(addDays(`${today.slice(0, 7)}-01`, -1))} ${formatUsd(spend.lastMonth)}`))
  if (spend.since) more.push(t.dim(` · since ${shortDate(spend.since)}`))

  if (!big) {
    if (width >= 160) return [t.row('cost', [rangeButtons(s, d, actions), chart, t.gap(2), ...totals, t.dim(' · '), ...more])]
    // Narrower: the chart leads, the range toggles move down a row.
    return [t.row('cost-1', [chart, t.gap(2), ...totals]), t.row('cost-2', [rangeButtons(s, d, actions), t.gap(1), ...(width >= 100 ? more : more.slice(0, 2))])]
  }

  // The pane: a taller chart with its labels, then the numbers.
  const labelRow = d.view.range === 'month'
    ? <Text dimColor>{shortDate(addDays(today, -29)).padEnd(buckets.length - 5)}today</Text>
    : <Text dimColor>{buckets.map(b => b.label.padEnd(shape.w).slice(0, shape.w) + ' '.repeat(shape.gap)).join('')}</Text>
  const tokens = live.tokens
  const counted = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite
  const out: RenderElement[] = [
    t.row('cost-range', [rangeButtons(s, d, actions)]),
    <Box key="cost-chart" flexDirection="column">{chart}{s.isTerminal ? labelRow : null}</Box>,
    t.row('cost-totals', totals),
    t.row('cost-more', more),
  ]
  if (counted > 0) {
    out.push(t.row('cost-tokens', [
      t.dim('tokens in '), t.plain(formatTokens(tokens.input + tokens.cacheRead + tokens.cacheWrite)),
      t.dim(' · out '), t.plain(formatTokens(tokens.output)),
      t.dim(' · cache hit '), t.plain(`${cacheHit({ input_tokens: tokens.input, cache_read_input_tokens: tokens.cacheRead, cache_creation_input_tokens: tokens.cacheWrite }) ?? 0}%`),
      tokens.subagent > 0 ? t.dim(` · subagents ${Math.round((tokens.subagent / counted) * 100)}%`) : t.dim(''),
    ]))
  }
  return out
}

function turnRows(s: Surface, d: Data, width: number, big: boolean): RenderElement[] {
  const t = kit(s)
  const { turns, live } = d
  if (turns.length === 0) return [t.row('turns', [t.dim('Turns show here as they finish.')])]
  const last = turns.at(-1) as Turn
  const mix = Object.entries(live.tools).sort((a, b) => b[1] - a[1]).slice(0, big || width >= 120 ? 5 : 3)
  const mixParts: RenderElement[] = []
  for (const [i, [tool, count]] of mix.entries()) mixParts.push(t.dim(i ? ' · ' : ''), t.plain(shorten(tool, 12)), t.dim(` ${count}`))

  const head: RenderElement[] = [
    timeline(s, 'timeline', turns, big ? 40 : width >= 120 ? 24 : 12), t.gap(2),
    t.dim(`${turns.length} turn${turns.length === 1 ? '' : 's'} · last `), t.plain(formatDuration(last.ms)),
    t.dim(` · ${last.tools} tool${last.tools === 1 ? '' : 's'}`),
  ]
  if (last.usd !== undefined) head.push(t.dim(' · '), t.plain(formatUsd(last.usd)))
  if (!big) return width >= 150 ? [t.row('turns', [...head, t.dim('   '), ...mixParts])] : [t.row('turns-1', head), t.row('turns-2', mixParts)]

  // The pane lists recent turns with fixed columns.
  const rows: RenderElement[] = [t.row('turns-head', head)]
  for (const [i, turn] of turns.slice(-8).reverse().entries()) {
    const previous = turns[turns.length - 2 - i]
    const grew = previous ? turn.tokens - previous.tokens : 0
    rows.push(t.row(`turn-${turn.n}`, [
      t.dim(`#${String(turn.n).padEnd(4)}`),
      t.plain(formatDuration(turn.ms).padStart(6)),
      t.dim(`  ${String(turn.tools).padStart(2)} tool${turn.tools === 1 ? ' ' : 's'}`),
      t.dim(`  ${grew === 0 ? '' : `${grew > 0 ? '+' : '-'}${formatTokens(Math.abs(grew))} ctx`}`.padEnd(12)),
      t.plain(turn.usd === undefined ? '' : formatUsd(turn.usd).padStart(6)),
      t.dim(turn.cacheHit === undefined ? '' : `  cache ${turn.cacheHit}%`),
      turn.isAborted ? t.paint('  interrupted', WARN) : t.dim(''),
    ]))
  }
  rows.push(t.row('turns-tools', [t.dim('tools '), ...mixParts]))
  return rows
}

// The dashboard pane: the glance row, then every section, larger.
export function dashboard(s: Surface, d: Data, width: number, actions: Actions): RenderElement {
  const { Box, Text } = s.ui
  const heading = (key: string, text: string) => (
    <Box key={key} marginTop={1}>
      <Text color={ACCENT} bold>{text}</Text>
    </Box>
  )
  return (
    <Box flexDirection="column">
      {glance(s, d, width, actions, true)}
      {heading('h-context', 'Context')}
      {section(s, d, 'context', width, actions, true)}
      {heading('h-limits', 'Plan limits')}
      {section(s, d, 'limits', width, actions, true)}
      {heading('h-cost', 'Spend')}
      {section(s, d, 'cost', width, actions, true)}
      {heading('h-turns', 'Turns')}
      {section(s, d, 'turns', width, actions, true)}
    </Box>
  )
}
