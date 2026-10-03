// Pure helpers: how numbers print, how fast a limit is burning, and what the
// cost ledger adds up to. Nothing here touches $, so it tests on its own.

import type { Ledger, Limit, Range } from '../types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// How long each rate-limit window lasts; a gateway's spend limit has none.
export const WINDOW_MS: Record<string, number> = { five_hour: 5 * HOUR, seven_day: 7 * DAY }
export const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

export function formatTokens(n: number): string {
  const trim = (x: string) => x.replace(/\.0$/, '')
  if (n >= 1_000_000) return `${trim((n / 1_000_000).toFixed(1))}M`
  if (n >= 1_000) return `${trim((n / 1_000).toFixed(n >= 100_000 ? 0 : 1))}k`
  return `${Math.round(n)}`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE))
  if (minutes >= 24 * 60) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
  return `${minutes}m`
}

export function formatUsd(usd: number): string {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`
  if (usd >= 100) return `$${Math.round(usd)}`
  return `$${usd.toFixed(2)}`
}

export function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// Green, yellow from 50, orange from 75, red from 90.
export function levelColor(percent: number): string {
  if (percent >= 90) return '#E5534B'
  if (percent >= 75) return '#E8964A'
  if (percent >= 50) return '#D6C35A'
  return '#7BC96F'
}

// A smooth heat scale for gradients: green, yellow at 50, orange at 75, red from 90.
const HEAT: [number, number][] = [[0, 0x5fb87a], [50, 0xd6c35a], [75, 0xe8964a], [90, 0xe5534b], [100, 0xe5534b]]
export function heat(percent: number): string {
  const p = clamp(percent)
  for (let i = 1; i < HEAT.length; i++) {
    const [b, cb] = HEAT[i] ?? [100, 0]
    const [a, ca] = HEAT[i - 1] ?? [0, 0]
    if (p <= b) {
      const t = b === a ? 0 : (p - a) / (b - a)
      const ch = (shift: number) => Math.round(((ca >> shift) & 255) * (1 - t) + ((cb >> shift) & 255) * t)
      return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
    }
  }
  return '#e5534b'
}

export type Pace = {
  // Where an even burn would put the window by now, 0-100.
  expected: number
  // Used over expected: 1 is on pace, 2 is burning twice as fast.
  ratio: number
  // Where the window ends at this pace, 0-100+.
  atReset: number
  // Milliseconds until 100% at this pace, when that comes before the reset.
  fullInMs?: number
  resetInMs: number
}

// Linear pace over the window so far. Undefined for a window of unknown
// length, or too early in one to say anything.
export function pace(limit: Limit, now: number): Pace | undefined {
  const length = WINDOW_MS[limit.kind]
  if (!length || !limit.resetsAt) return undefined
  const resetInMs = Date.parse(limit.resetsAt) - now
  if (!Number.isFinite(resetInMs) || resetInMs <= 0) return undefined
  const elapsed = Math.max(0, length - resetInMs)
  if (elapsed < Math.min(length * 0.02, 10 * MINUTE)) return undefined
  const expected = (elapsed / length) * 100
  const ratio = limit.percentUsed / expected
  const atReset = limit.percentUsed / (elapsed / length)
  const perMs = limit.percentUsed / elapsed
  const left = perMs > 0 ? (100 - limit.percentUsed) / perMs : Infinity
  return { expected, ratio, atReset, resetInMs, fullInMs: left < resetInMs ? Math.max(0, left) : undefined }
}

// Color by where the window is heading, not only where it is.
export function paceColor(limit: Limit, p: Pace | undefined): string {
  if (!p) return levelColor(limit.percentUsed)
  if (p.fullInMs !== undefined) return '#E5534B'
  return levelColor(Math.max(limit.percentUsed, Math.min(89, p.atReset)))
}

// Local calendar day as YYYY-MM-DD.
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(day: string, n: number): string {
  const d = dayStart(day)
  d.setDate(d.getDate() + n)
  return dayKey(d.getTime())
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function monthName(day: string): string {
  return MONTHS[dayStart(day).getMonth()] ?? ''
}

export function shortDate(day: string): string {
  const d = dayStart(day)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export type Spend = {
  today: number
  week: number
  month: number
  monthLabel: string
  // This month's spend carried to its last day at the pace so far.
  monthForecast: number
  lastMonth: number
  all: number
  perDay: number
  since?: string
}

export function summarize(ledger: Ledger, today: string): Spend {
  const weekStart = addDays(today, -6)
  const month = today.slice(0, 7)
  const start = dayStart(today)
  const lastMonthKey = dayKey(new Date(start.getFullYear(), start.getMonth() - 1, 1).getTime()).slice(0, 7)
  let week = 0
  let monthTotal = 0
  let lastMonth = 0
  let all = 0
  for (const [day, usd] of Object.entries(ledger.days)) {
    all += usd
    if (day >= weekStart && day <= today) week += usd
    if (day.startsWith(month)) monthTotal += usd
    if (day.startsWith(lastMonthKey)) lastMonth += usd
  }
  const dayOfMonth = start.getDate()
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const firstDay = ledger.since && ledger.since > `${month}-01` ? dayStart(ledger.since).getDate() : 1
  const daysTracked = Math.max(1, dayOfMonth - firstDay + 1)
  const weekDays = Math.max(1, Math.min(7, ledger.since ? daysBetween(ledger.since, today) + 1 : 7))
  return {
    today: ledger.days[today] ?? 0,
    week,
    month: monthTotal,
    monthLabel: MONTHS[start.getMonth()] ?? '',
    monthForecast: monthTotal + (monthTotal / daysTracked) * (daysInMonth - dayOfMonth),
    lastMonth,
    all,
    perDay: week / weekDays,
    since: ledger.since,
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / DAY)
}

export type Bucket = { label: string; usd: number; isNow: boolean }

// Spend per bar for a range: 7 days, 30 days, or 12 months, oldest first.
export function series(ledger: Ledger, today: string, range: Range): Bucket[] {
  if (range === 'year') {
    const start = dayStart(today)
    const out: Bucket[] = []
    for (let i = 11; i >= 0; i--) {
      const key = dayKey(new Date(start.getFullYear(), start.getMonth() - i, 1).getTime()).slice(0, 7)
      let usd = 0
      for (const [day, v] of Object.entries(ledger.days)) if (day.startsWith(key)) usd += v
      out.push({ label: MONTHS[Number(key.slice(5)) - 1]?.slice(0, 1) ?? '', usd, isNow: i === 0 })
    }
    return out
  }
  const count = range === 'week' ? 7 : 30
  const out: Bucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const day = addDays(today, -i)
    const label = range === 'week' ? (WEEKDAYS[dayStart(day).getDay()] ?? '') : String(dayStart(day).getDate())
    out.push({ label, usd: ledger.days[day] ?? 0, isNow: i === 0 })
  }
  return out
}

// What a tool call counts as in the tool mix.
export function toolGroup(tool: string): string {
  if (tool.startsWith('mcp__')) return 'MCP'
  if (tool === 'Task') return 'Agent'
  if (tool === 'MultiEdit' || tool === 'NotebookEdit') return 'Edit'
  return tool
}

// Share of the input the prompt cache served, 0-100.
export function cacheHit(u: { input_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }): number | undefined {
  const total = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
  return total > 0 ? Math.round((u.cache_read_input_tokens / total) * 100) : undefined
}

// Average context growth per turn over the last few, and turns left at it.
export function forecast(tokens: number[], window: number): { perTurn: number; turnsLeft?: number } | undefined {
  const recent = tokens.slice(-6)
  const steps: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const step = (recent[i] ?? 0) - (recent[i - 1] ?? 0)
    if (step > 0) steps.push(step) // a compaction is a drop, not a turn's growth
  }
  if (steps.length === 0) return undefined
  const perTurn = steps.reduce((a, b) => a + b, 0) / steps.length
  const last = recent.at(-1) ?? 0
  return { perTurn, turnsLeft: perTurn > 0 ? Math.max(0, Math.floor((window - last) / perTurn)) : undefined }
}

export function clamp(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}
