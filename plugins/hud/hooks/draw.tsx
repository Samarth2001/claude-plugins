// What HUD draws. The band is one row across the full width; pressing a
// label opens a drawer under it with that metric's detail, laid out as a
// small table. The pane shows every drawer, larger.

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
  levelColor,
  monthName,
  pace,
  paceColor,
  series,
  shortDate,
  shorten,
  summarize,
} from './calc'
import { ACCENT, SLIDE_MS, bar, capsule, columns, icon, iconSpace, mix, heartbeat, spark, timeline } from './widgets'
import type { IconKind } from './widgets'
import type { Surface } from './widgets'

export type Data = {
  snap: Snapshot
  turns: Turn[]
  live: Live
  ledger: Ledger
  view: View
  now: number
  today: string
  isLight: boolean
}

export type Actions = {
  setView: (change: Partial<View>) => void
  openPane: () => void
}

export { ACCENT }
const GOOD = '#7BC96F'
const WARN = '#E8964A'
const HOT = '#E5534B'
const FRAME_MS = 140
// How long a fresh reading glows, and how long its meter takes to slide there.
export const FLASH_MS = 1400
// The drawer's first column, so its rows line up as a table.
const LABEL_COLS = 12

const RANGES: { range: Range; label: string }[] = [
  { range: 'week', label: '7d' },
  { range: 'month', label: '30d' },
  { range: 'year', label: '12mo' },
]

// Each limit's name: short for the row when space is tight (the toasts' too),
// long otherwise.
const LONG_LIMIT_NAMES: Record<string, string> = { five_hour: '5-hour', seven_day: 'weekly', spend_limit: 'spend cap' }
const limitName = (kind: string, isLong: boolean) => (isLong ? LONG_LIMIT_NAMES : LIMIT_LABELS)[kind] ?? kind

function kit(s: Surface) {
  const { Text } = s.ui
  return {
    dim: (text: string) => <Text dimColor>{text}</Text>,
    plain: (text: string) => <Text>{text}</Text>,
    paint: (text: string, color: string, bold = false) => <Text color={color} bold={bold}>{text}</Text>,
  }
}

const isFlashing = (d: Data, unit: keyof Live['flash']) => d.live.flash[unit] > d.now

// Where a meter is drawn while it slides from its last reading to this one.
function sliding(d: Data, unit: 'context' | 'limits', to: number, from: number | undefined): number {
  if (from === undefined || !isFlashing(d, unit)) return to
  const t = Math.min(1, Math.max(0, (d.now - (d.live.flash[unit] - FLASH_MS)) / SLIDE_MS))
  const ease = 1 - (1 - t) ** 3
  return from + (to - from) * ease
}

// Each chip's hue: its icon, its tint and its meter's track are mixed from it.
const HUES = {
  status: '#B4A7F5',
  claude: '#D77757',
  context: '#6CC4A1',
  five_hour: '#62BFC0',
  seven_day: '#A99AF0',
  tokens: '#7FA8F0',
  cost: '#E6B85C',
} as const
type Hue = keyof typeof HUES

// A chip's colors on the current theme: the hue, and its meter's track.
function tone(d: Data, hue: Hue) {
  const base = d.isLight ? '#FFFFFF' : '#1C1D22'
  const color = HUES[hue]
  return {
    fg: d.isLight ? mix(color, '#000000', 0.35) : color,
    track: mix(color, base, 0.62),
  }
}

// A fresh value glows toward white and fades back to its color.
function glow(d: Data, unit: keyof Live['flash'], color: string): string {
  const left = (d.live.flash[unit] - d.now) / FLASH_MS
  return left > 0 ? mix(color, d.isLight ? '#000000' : '#FFFFFF', Math.min(1, left) * 0.7) : color
}

// Context as a pie that fills with the window.
const PIES = '○◔◑◕●'
const pie = (percent: number) => PIES[Math.min(4, Math.round((percent / 100) * 4))] ?? '○'
// Claude Code's own spinner, out and back, so the band's motion reads as Claude's.
const SPINNER = [...'·✢*✶✻✽', ...'✽✻✶*✢·']

// A metric's name: the control that opens its drawer.
function label(s: Surface, d: Data, actions: Actions, tab: Tab, id: string, text: string): RenderElement {
  const { Button } = s.ui
  const isOpen = d.view.mode === 'detail' && d.view.tab === tab
  return (
    <Button key={`open-${tab}-${id}`} label={text} plain dimColor={!isOpen}
      onPress={() => actions.setView(isOpen ? { mode: 'glance' } : { mode: 'detail', tab })} />
  )
}

type Tier = 'full' | 'mid' | 'compact' | 'tiny'
const TIERS: Tier[] = ['full', 'mid', 'compact', 'tiny']
const METER: Record<Tier, number> = { full: 10, mid: 8, compact: 6, tiny: 0 }
// Columns between chips: flat items need room to read apart.
const GAP = 3

// One chip of the row, and how many columns it takes.
type Chip = { key: string; cols: number; draw: () => RenderElement }

// The one row: a chip per metric, left on an even rhythm. It
// picks the richest layout that fits: names, meters and extras when wide,
// then fewer extras, then icons and meters, then icons and numbers.
export function glance(s: Surface, d: Data, width: number, actions: Actions, isPane = false): RenderElement {
  const { Box, Button, Text } = s.ui
  const { snap, live, now } = d

  // Claude's own spinner and clay say what Claude is doing in the terminal;
  // the desktop keeps its vector heartbeat in the status hue.
  const statusHue: Hue = s.isTerminal ? 'claude' : 'status'
  const txt = (hue: Hue, text: string, style: { dim?: boolean; bold?: boolean; color?: string } = {}) => (
    <Text color={style.color} bold={style.bold} dimColor={style.dim}>{text}</Text>
  )
  // A chip: its icon in the hue, then whatever the metric shows, flat on the
  // band so the row stays one line tall. The icon is a glyph in the terminal
  // and a lit vector tile elsewhere. With no name to press (narrow rows) the
  // terminal's glyph opens the drawer, and elsewhere the value does.
  const chip = (key: string, hue: Hue, glyph: string, body: RenderElement[], press?: { tab: Tab; id: string }, kind?: IconKind, percent?: number) => {
    const c = tone(d, hue)
    const mark = !s.isTerminal && kind
      ? icon(s, kind, c.fg, percent)
      : press ? label(s, d, actions, press.tab, press.id, glyph) : <Text color={c.fg}>{glyph}</Text>
    return (
      <Box key={`chip-${key}`} flexShrink={0} alignItems="center">
        {mark}
        <Text> </Text>
        {body}
      </Box>
    )
  }
  // A meter: a vector capsule on the desktop, a row of segments in the terminal.
  const meterOf = (key: string, unit: 'context' | 'limits', to: number, from: number | undefined, cols: number, hue: Hue, mark?: number) => {
    const c = tone(d, hue)
    if (s.isTerminal) return bar(s, key, sliding(d, unit, to, from), cols, mark, c.track)
    return capsule(s, key, to, cols, mark, isFlashing(d, unit) ? from : undefined, now - (d.live.flash[unit] - FLASH_MS))
  }

  const plan = (tier: Tier) => {
    const chips: Chip[] = []
    const meter = METER[tier]
    const named = tier === 'full' || tier === 'mid'

    // What Claude is doing: a spinner and a shimmer while it works, else idle.
    if (live.isWorking) {
      const frame = Math.floor(now / FRAME_MS)
      const clock = formatDuration(now - live.turnStartedAt)
      const tools = named && live.toolsThisTurn > 0 ? ` · ${live.toolsThisTurn} tool${live.toolsThisTurn === 1 ? '' : 's'}` : ''
      const word = named ? 'working' : ''
      chips.push({
        key: 'status', cols: 2 + (word ? word.length + 1 : 0) + clock.length + tools.length,
        draw: () => {
          const c = tone(d, statusHue)
          // A highlight sweeps across the word, as on Claude's own spinner line.
          const head = (frame % (word.length + 8)) - 3
          const bright = mix(c.fg, d.isLight ? '#000000' : '#FFFFFF', 0.6)
          const letters = [...word].map((ch, i) => (
            <Text key={`shimmer-${i}`} color={mix(c.fg, bright, Math.max(0, 1 - Math.abs(i - head) / 2.5))}>{ch}</Text>
          ))
          const motion = s.isTerminal ? letters : [heartbeat(s, 5, c.fg)]
          return chip('status', statusHue, SPINNER[frame % SPINNER.length] ?? '✻', [
            ...motion, ...(word ? [txt(statusHue, ' ')] : []),
            txt(statusHue, clock, { bold: true, color: c.fg }),
            ...(tools ? [txt(statusHue, tools, { dim: true })] : []),
          ], undefined, 'working')
        },
      })
    } else {
      chips.push({
        key: 'status', cols: 2 + 4,
        draw: () => chip('status', statusHue, '✻', [label(s, d, actions, 'turns', 'idle', 'idle')], undefined, 'idle'),
      })
    }

    // Context.
    {
      const p = snap.percent
      const value = p === undefined ? '—' : `${p}%`
      const hasMeter = meter > 0 && p !== undefined
      chips.push({
        key: 'ctx', cols: 2 + (named ? 8 : 0) + (hasMeter ? meter + 1 : 0) + value.length,
        draw: () => {
          const shown = p === undefined
            ? txt('context', value, { dim: true })
            : txt('context', value, { bold: true, color: glow(d, 'context', levelColor(p)) })
          return chip('ctx', 'context', pie(p ?? 0), [
            ...(named ? [label(s, d, actions, 'context', 'ctx', 'context'), txt('context', ' ')] : []),
            ...(hasMeter ? [meterOf('bar-ctx', 'context', p, live.previous.percent, meter, 'context'), txt('context', ' ')] : []),
            !named && !s.isTerminal ? label(s, d, actions, 'context', 'ctx', value) : shown,
          ], named ? undefined : { tab: 'context', id: 'ctx' }, 'context', p ?? 0)
        },
      })
    }

    // Plan limits.
    for (const limit of snap.limits) {
      const hue: Hue = limit.kind === 'seven_day' ? 'seven_day' : 'five_hour'
      const p = pace(limit, now)
      const name = limitName(limit.kind, tier === 'full')
      const value = `${Math.round(limit.percentUsed)}%`
      const showReset = limit.resetsAt !== undefined && (tier === 'full' || (tier === 'mid' && limit.kind === 'five_hour'))
      const reset = showReset ? formatSpan(Date.parse(limit.resetsAt as string) - now) : ''
      const id = limit.kind === 'seven_day' ? '7d' : limit.kind === 'five_hour' ? '5h' : limit.kind
      chips.push({
        key: `limit-${limit.kind}`,
        cols: 2 + (named ? name.length + 1 : 0) + (meter ? meter + 1 : 0) + value.length + (reset ? 5 + reset.length : 0),
        draw: () => {
          return chip(`limit-${limit.kind}`, hue, limit.kind === 'seven_day' ? '▦' : '◷', [
            ...(named ? [label(s, d, actions, 'limits', id, name), txt(hue, ' ')] : []),
            ...(meter ? [meterOf(`bar-${limit.kind}`, 'limits', limit.percentUsed, live.previous.limits[limit.kind], meter, hue, p?.expected), txt(hue, ' ')] : []),
            !named && !s.isTerminal ? label(s, d, actions, 'limits', id, value) : txt(hue, value, { bold: true, color: glow(d, 'limits', paceColor(limit, p)) }),
            ...(reset ? [txt(hue, ' │ ', { dim: true }), txt(hue, `↻ ${reset}`, { dim: true })] : []),
          ], named ? undefined : { tab: 'limits', id }, limit.kind === 'seven_day' ? 'seven_day' : 'five_hour')
        },
      })
    }

    // Tokens this session, when there's room: in and out.
    const tk = live.tokens
    const tokIn = tk.input + tk.cacheRead + tk.cacheWrite
    if (tier === 'full' && tokIn + tk.output > 0) {
      chips.push({
        key: 'tokens', cols: (s.isTerminal ? 0 : 2) + `↑ ${formatTokens(tokIn)}  ↓ ${formatTokens(tk.output)}`.length,
        draw: () => {
          const c = tone(d, 'tokens')
          return (
            <Box key="chip-tokens" flexShrink={0} alignItems="center">
              {s.isTerminal ? null : icon(s, 'tokens', c.fg)}
              {s.isTerminal ? null : <Text> </Text>}
              <Text color={c.fg}>↑ </Text>{txt('tokens', formatTokens(tokIn), { bold: true })}
              <Text color={c.fg}>  ↓ </Text>{txt('tokens', formatTokens(tk.output), { bold: true })}
            </Box>
          )
        },
      })
    }

    // Money: this session, then this month across sessions.
    if (snap.usd !== undefined) {
      const spend = summarize(d.ledger, d.today)
      const value = formatUsd(snap.usd)
      const month = named ? `${spend.monthLabel} ${formatUsd(spend.month)}` : ''
      chips.push({
        key: 'cost', cols: 2 + (named ? 6 : 0) + value.length + (month ? 3 + month.length : 0),
        draw: () => chip('cost', 'cost', '$', [
          ...(named ? [label(s, d, actions, 'cost', 'cost', 'spent'), txt('cost', ' ')] : []),
          !named && !s.isTerminal ? label(s, d, actions, 'cost', 'cost', value) : txt('cost', value, { bold: true, color: glow(d, 'cost', tone(d, 'cost').fg) }),
          ...(month ? [txt('cost', ' │ ', { dim: true }), txt('cost', month, { dim: true })] : []),
        ], named || !s.isTerminal ? undefined : { tab: 'cost', id: 'cost' }, 'cost'),
      })
    }

    const controls = isPane ? 0 : named ? 6 : 3
    // Off the terminal an icon is a tile two cells wide, not a one-cell glyph.
    const extra = s.isTerminal ? 0 : 1
    const need = chips.reduce((a, x) => a + x.cols + extra, 0) + chips.length * GAP + controls
    return { chips, named, fits: need <= width }
  }

  const { chips, named } = TIERS.map(plan).find(x => x.fits) ?? plan('tiny')
  const isOpen = d.view.mode === 'detail'
  // The items sit left on an even rhythm; the controls keep to the right edge.
  return (
    <Box key="glance" alignItems="center" width="100%" columnGap={GAP}>
      {chips.map(x => x.draw())}
      <Box key="spacer" flexGrow={1} />
      {isPane ? null : (
        <Box key="controls" flexShrink={0} alignItems="center" columnGap={1}>
          {named ? <Button key="pane" label="⤢" plain dimColor onPress={actions.openPane} /> : null}
          <Button key="expand" label={isOpen ? '▴' : '▾'} plain onPress={() => actions.setView({ mode: isOpen ? 'glance' : 'detail' })} />
        </Box>
      )}
    </Box>
  )
}

// The open drawer under the row: a breath of space, then its rows as a table.
export function drawer(s: Surface, d: Data, width: number, actions: Actions): RenderElement[] {
  const { Box, Button } = s.ui
  const rows = section(s, d, d.view.tab, width, actions, false)
  const hide = s.isTerminal ? null : (
    <Box key="drawer-hide" marginLeft={2} flexShrink={0}>
      <Button key="hide" label="hide band" plain dimColor onPress={() => actions.setView({ mode: 'hidden' })} />
    </Box>
  )
  return rows.map((row, i) => (
    <Box key={`drawer-${i}`} alignItems="center" width="100%" paddingX={1} marginTop={i === 0 ? 1 : 0}>
      <Box flexGrow={1} overflow="hidden">{row}</Box>
      {i === 0 ? hide : null}
    </Box>
  ))
}

// Each drawer row's name, with the icon its chip wears in the band: a glyph
// in the terminal, the chip's vector tile and hue elsewhere.
const ROW_ICONS: Record<string, string> = {
  context: '◑', outlook: '↗', '5-hour': '◷', weekly: '▦', 'spend cap': '$', spend: '$', range: ' ', spent: '$',
  tokens: '↕', turns: '✻', tools: '⚒', limits: '◷',
}
const ROW_TILES: Record<string, { kind: IconKind; hue: Hue }> = {
  context: { kind: 'context', hue: 'context' },
  '5-hour': { kind: 'five_hour', hue: 'five_hour' },
  limits: { kind: 'five_hour', hue: 'five_hour' },
  weekly: { kind: 'seven_day', hue: 'seven_day' },
  'spend cap': { kind: 'cost', hue: 'cost' },
  spend: { kind: 'cost', hue: 'cost' },
  spent: { kind: 'cost', hue: 'cost' },
  tokens: { kind: 'tokens', hue: 'tokens' },
  turns: { kind: 'idle', hue: 'status' },
}

// Splits a drawer row's parts into items: what reads together stays together.
// A row too narrow for every item wraps whole items to the next line, under
// the first column, instead of breaking a phrase in two.
const BREAK = { hudBreak: true } as unknown as RenderElement
const isBreak = (el: RenderElement) => el === BREAK

// A drawer row: a fixed first column naming it, then its items.
function line(s: Surface, key: string, name: string, parts: RenderElement[], color?: string): RenderElement {
  const { Box, Text } = s.ui
  const glyph = ROW_ICONS[name]
  const tile = ROW_TILES[name]
  const tileHue = tile && s.isTerminal && tile.hue === 'status' ? 'claude' : tile?.hue
  const hue = color ?? (tileHue ? HUES[tileHue] : ACCENT)
  const head = s.isTerminal
    ? [glyph ? <Text key="glyph" color={hue}>{`${glyph} `}</Text> : null, <Text key="name" color={hue} dimColor={name === ''}>{name}</Text>]
    : [tile ? icon(s, tile.kind, HUES[tile.hue], 0) : iconSpace(s, `${key}-space`), <Text key="name" color={hue}>{` ${name}`}</Text>]
  const items: RenderElement[][] = [[]]
  for (const part of parts) {
    if (isBreak(part)) items.push([])
    else items.at(-1)?.push(part)
  }
  return (
    <Box key={key} alignItems="flex-start" overflow="hidden">
      <Box width={LABEL_COLS + (s.isTerminal ? 0 : 2)} flexShrink={0} alignItems="center">{head}</Box>
      <Box flexGrow={1} flexShrink={1} flexWrap="wrap" columnGap={3} alignItems="center">
        {items.filter(x => x.length).map((item, i) => (
          <Box key={`${key}-item-${i}`} flexShrink={0} alignItems="center">{item}</Box>
        ))}
      </Box>
    </Box>
  )
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

// How wide a drawer's meter or chart is: a quarter of the row, within reason.
const meterWidth = (width: number, big: boolean) => Math.max(10, Math.min(big ? 48 : 32, Math.floor(width * (big ? 0.45 : 0.25))))

function contextRows(s: Surface, d: Data, width: number, big: boolean): RenderElement[] {
  const t = kit(s)
  const { snap, turns, live } = d
  if (snap.percent === undefined) return [line(s, 'ctx', 'context', [t.dim('Measured after the first response.')])]
  const percent = snap.percent
  const history = [...turns.map(x => x.percent), percent]
  const first: RenderElement[] = [
    bar(s, 'ctx-meter', sliding(d, 'context', percent, live.previous.percent), meterWidth(width, big)), BREAK,
    t.paint(`${percent}%`, glow(d, 'context', levelColor(percent)), true),
    t.dim(' full'),
  ]
  if (snap.tokens !== undefined) first.push(BREAK, t.plain(`${formatTokens(snap.tokens)} of ${formatTokens(snap.window)} tokens`))
  const last = turns.at(-1)
  const before = turns.at(-2)
  if (last && before && last.tokens !== before.tokens) {
    const delta = last.tokens - before.tokens
    first.push(BREAK, t.paint(`${delta > 0 ? '▲' : '▼'}${formatTokens(Math.abs(delta))}`, delta > 0 ? levelColor(percent) : GOOD), t.dim(' last turn'))
  }

  const second: RenderElement[] = []
  const sep = () => (second.length ? [BREAK] : [])
  if (history.length >= 3) second.push(spark(s, 'ctx-spark', history, big ? 40 : 16), t.dim(' per turn'))
  const f = forecast(turns.map(x => x.tokens), snap.window)
  if (f) {
    second.push(...sep(), t.dim('+'), t.plain(formatTokens(f.perTurn)), t.dim(' a turn'))
    if (f.turnsLeft !== undefined) second.push(BREAK, t.paint(`~${f.turnsLeft}`, levelColor(percent), true), t.dim(' turns left'))
  }
  if (last?.cacheHit !== undefined) second.push(...sep(), t.dim('cache hit '), t.paint(`${last.cacheHit}%`, last.cacheHit >= 70 ? GOOD : WARN))
  if (live.model) second.push(...sep(), t.dim(live.model.replace(/^claude-/, '')))
  if (percent >= 80) second.push(...sep(), t.paint('/compact soon', levelColor(percent), true))
  const rows = [line(s, 'ctx-1', 'context', first)]
  if (second.length) rows.push(line(s, 'ctx-2', 'outlook', second))
  return rows
}

function limitRow(s: Surface, d: Data, limit: Limit, cols: number, isLast: boolean, width: number): RenderElement {
  const t = kit(s)
  const p = pace(limit, d.now)
  const color = paceColor(limit, p)
  const parts: RenderElement[] = [
    bar(s, `wide-${limit.kind}`, sliding(d, 'limits', limit.percentUsed, d.live.previous.limits[limit.kind]), cols, p?.expected), BREAK,
    t.paint(`${Math.round(limit.percentUsed)}%`, glow(d, 'limits', color), true), t.dim(' used'),
  ]
  if (p) {
    parts.push(BREAK, t.dim('pace '), t.paint(`${p.ratio.toFixed(1)}×`, color, true))
    if (p.fullInMs !== undefined) parts.push(BREAK, t.paint(`full in ~${formatSpan(p.fullInMs)}`, HOT, true))
    else parts.push(BREAK, t.paint(`${Math.round(p.atReset)}%`, color), t.dim(' at reset'))
  }
  if (limit.resetsAt) parts.push(BREAK, t.dim('resets in '), t.plain(formatSpan(Date.parse(limit.resetsAt) - d.now)))
  if (isLast && width >= 140) parts.push(BREAK, t.paint('▮', ACCENT), t.dim(' even pace'))
  return line(s, `limit-${limit.kind}`, limitName(limit.kind, true), parts)
}

function limitRows(s: Surface, d: Data, width: number, big: boolean): RenderElement[] {
  const t = kit(s)
  if (d.snap.limits.length === 0) return [line(s, 'limits', 'limits', [t.dim('Plan limits show after a response on a subscription.')])]
  const cols = meterWidth(width, big)
  const rows = d.snap.limits.map((limit, i) => limitRow(s, d, limit, cols, i === d.snap.limits.length - 1, big ? 0 : width))
  if (big) {
    rows.push(line(s, 'limits-legend', '', [
      t.paint('▮', ACCENT), t.dim(' where an even pace would be by now · pace '), t.plain('1.0×'), t.dim(' lands at 100% right at reset'),
    ]))
  }
  return rows
}

// The chart's range: the chosen one bracketed, so the toggle reads at a glance.
function rangeButtons(s: Surface, d: Data, actions: Actions): RenderElement {
  const { Box, Button } = s.ui
  return (
    <Box key="ranges" flexShrink={0}>
      {RANGES.map(({ range, label: text }) => {
        const isOn = d.view.range === range
        return (
          <Box key={`range-${range}`} marginRight={1}>
            {isOn
              ? <Button key={range} label={text} variant="primary" onPress={() => actions.setView({ range })} />
              : <Button key={range} label={text} plain dimColor onPress={() => actions.setView({ range })} />}
          </Box>
        )
      })}
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
  // Off the terminal the pane's chart carries its own labels, so they line up.
  const labels = big && !s.isTerminal
    ? buckets.map((b, i) => (d.view.range !== 'month' ? b.label : i === buckets.length - 1 ? 'today' : i === 0 ? shortDate(addDays(today, -29)) : ''))
    : undefined
  const chart = columns(s, `chart-${d.view.range}`, buckets.map(b => b.usd), shape.w, shape.gap, big ? 4 : 1, labels)

  const totals: RenderElement[] = [
    t.dim('today '), t.plain(formatUsd(spend.today)),
    BREAK, t.dim('7d '), t.plain(formatUsd(spend.week)),
    BREAK, t.dim(`${spend.monthLabel} `), t.paint(formatUsd(spend.month), ACCENT, true),
    t.dim(' → '), t.plain(`~${formatUsd(spend.monthForecast)}`), t.dim(' by month end'),
  ]
  const more: RenderElement[] = [
    t.dim('this session '), t.paint(formatUsd(snap.usd ?? 0), glow(d, 'cost', tone(d, 'cost').fg), true),
    BREAK, t.dim('avg '), t.plain(formatUsd(spend.perDay)), t.dim(' a day'),
  ]
  if (spend.lastMonth > 0) more.push(BREAK, t.dim(`${monthName(addDays(`${today.slice(0, 7)}-01`, -1))} `), t.plain(formatUsd(spend.lastMonth)))
  if (spend.since) more.push(BREAK, t.dim(`tracked since ${shortDate(spend.since)}`))

  if (!big) {
    return [
      line(s, 'cost-1', 'spend', [rangeButtons(s, d, actions), BREAK, chart, BREAK, ...totals]),
      line(s, 'cost-2', '', width >= 100 ? more : more.slice(0, 2)),
    ]
  }

  // The pane: a taller chart with its labels, then the numbers.
  const labelRow = d.view.range === 'month'
    ? <Text dimColor>{shortDate(addDays(today, -29)).padEnd(Math.max(0, buckets.length - 5))}today</Text>
    : <Text dimColor>{buckets.map(b => b.label.padEnd(shape.w).slice(0, shape.w) + ' '.repeat(shape.gap)).join('')}</Text>
  const tokens = live.tokens
  const counted = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite
  const out: RenderElement[] = [
    line(s, 'cost-range', 'range', [rangeButtons(s, d, actions)]),
    line(s, 'cost-chart', '', [<Box key="chart-box" flexDirection="column">{chart}{s.isTerminal ? labelRow : null}</Box>]),
    line(s, 'cost-totals', 'spent', totals),
    line(s, 'cost-more', '', more),
  ]
  if (counted > 0) {
    out.push(line(s, 'cost-tokens', 'tokens', [
      t.dim('in '), t.plain(formatTokens(tokens.input + tokens.cacheRead + tokens.cacheWrite)),
      BREAK, t.dim('out '), t.plain(formatTokens(tokens.output)),
      BREAK, t.dim('cache hit '), t.plain(`${cacheHit({ input_tokens: tokens.input, cache_read_input_tokens: tokens.cacheRead, cache_creation_input_tokens: tokens.cacheWrite }) ?? 0}%`),
      tokens.subagent > 0 ? t.dim(` · subagents ${Math.round((tokens.subagent / counted) * 100)}%`) : t.dim(''),
    ]))
  }
  return out
}

function turnRows(s: Surface, d: Data, width: number, big: boolean): RenderElement[] {
  const t = kit(s)
  const { turns, live } = d
  if (turns.length === 0) return [line(s, 'turns', 'turns', [t.dim('Turns show here as they finish.')])]
  const last = turns.at(-1) as Turn
  const mix = Object.entries(live.tools).sort((a, b) => b[1] - a[1]).slice(0, big || width >= 120 ? 6 : 3)
  const mixParts: RenderElement[] = []
  for (const [i, [tool, count]] of mix.entries()) mixParts.push(t.dim(i ? ' · ' : ''), t.plain(shorten(tool, 12)), t.dim(` ${count}`))

  const head: RenderElement[] = [
    timeline(s, 'timeline', turns, meterWidth(width, big)), BREAK,
    t.plain(`${turns.length} turn${turns.length === 1 ? '' : 's'}`), BREAK, t.dim('last '), t.plain(formatDuration(last.ms)),
    BREAK, t.dim(`${last.tools} tool${last.tools === 1 ? '' : 's'}`),
  ]
  if (last.usd !== undefined) head.push(BREAK, t.plain(formatUsd(last.usd)))
  const rows: RenderElement[] = [line(s, 'turns-1', 'turns', head)]
  if (!big) {
    if (mixParts.length) rows.push(line(s, 'turns-2', 'tools', mixParts))
    return rows
  }

  // The pane lists recent turns with fixed columns.
  for (const [i, turn] of turns.slice(-8).reverse().entries()) {
    const previous = turns[turns.length - 2 - i]
    const grew = previous ? turn.tokens - previous.tokens : 0
    rows.push(line(s, `turn-${turn.n}`, `#${turn.n}`, [
      t.plain(formatDuration(turn.ms).padStart(6)),
      t.dim(`  ${String(turn.tools).padStart(2)} tool${turn.tools === 1 ? ' ' : 's'}`),
      t.dim(`  ${grew === 0 ? '' : `${grew > 0 ? '+' : '-'}${formatTokens(Math.abs(grew))} ctx`}`.padEnd(12)),
      t.plain(turn.usd === undefined ? '' : formatUsd(turn.usd).padStart(6)),
      t.dim(turn.cacheHit === undefined ? '' : `  cache ${turn.cacheHit}%`),
      turn.isAborted ? t.paint('  interrupted', WARN) : t.dim(''),
    ], '#8B8F98'))
  }
  if (mixParts.length) rows.push(line(s, 'turns-tools', 'tools', mixParts))
  return rows
}

// The dashboard pane: the row, then every section under a heading.
export function dashboard(s: Surface, d: Data, width: number, actions: Actions): RenderElement {
  const { Box, Text } = s.ui
  const inner = Math.max(40, width - 4)
  const heading = (key: string, text: string, hint: string) => (
    <Box key={key} marginTop={1} marginBottom={0}>
      <Text color={ACCENT} bold>{text}</Text>
      <Text dimColor>{`  ${hint}`}</Text>
    </Box>
  )
  return (
    <Box flexDirection="column" paddingX={2} paddingY={s.isTerminal ? 0 : 1}>
      {glance(s, d, inner, actions, true)}
      {heading('h-context', 'Context', 'how full the conversation window is')}
      {section(s, d, 'context', inner, actions, true)}
      {heading('h-limits', 'Plan limits', 'your subscription windows, and how fast you are using them')}
      {section(s, d, 'limits', inner, actions, true)}
      {heading('h-cost', 'Spend', 'sessions with HUD on this machine; not a bill')}
      {section(s, d, 'cost', inner, actions, true)}
      {heading('h-turns', 'Turns', 'each response, how long it took and what it used')}
      {section(s, d, 'turns', inner, actions, true)}
    </Box>
  )
}
