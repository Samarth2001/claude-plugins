import { describe, expect, test } from 'claude-code/testing'

import { addDays, columns, ekg, forecast, formatTokens, formatUsd, meter, pace, series, summarize } from './calc'

const HOUR = 3_600_000
const NOW = Date.UTC(2026, 9, 15, 12)

describe('pace', () => {
  test('reads ahead of an even burn as a ratio and a forecast', async () => {
    // 3h into a 5h window, 90% used: 1.5x pace, full before the reset.
    const p = pace({ kind: 'five_hour', percentUsed: 90, resetsAt: new Date(NOW + 2 * HOUR).toISOString() }, NOW)
    expect(p?.expected).toBe(60)
    expect(p?.ratio).toBe(1.5)
    expect(p?.atReset).toBe(150)
    expect(p?.fullInMs).toBe(20 * 60_000)
  })

  test('behind pace has no full-by time', async () => {
    const p = pace({ kind: 'five_hour', percentUsed: 30, resetsAt: new Date(NOW + 2 * HOUR).toISOString() }, NOW)
    expect(p?.atReset).toBe(50)
    expect(p?.fullInMs).toBeUndefined()
  })

  test('says nothing for a window of unknown length or with no reset', async () => {
    expect(pace({ kind: 'spend_limit', percentUsed: 40, resetsAt: new Date(NOW + HOUR).toISOString() }, NOW)).toBeUndefined()
    expect(pace({ kind: 'five_hour', percentUsed: 40 }, NOW)).toBeUndefined()
  })
})

describe('ledger', () => {
  const ledger = {
    since: '2026-09-20',
    days: { '2026-09-20': 10, '2026-09-30': 5, '2026-10-01': 2, '2026-10-09': 3, '2026-10-15': 4 },
  }

  test('adds up today, the last 7 days, this month and last month', async () => {
    const s = summarize(ledger, '2026-10-15')
    expect(s.today).toBe(4)
    expect(s.week).toBe(7) // Oct 9 to Oct 15
    expect(s.month).toBe(9)
    expect(s.monthLabel).toBe('Oct')
    expect(s.lastMonth).toBe(15)
    expect(s.all).toBe(24)
    // 9 over 15 days carried to 31.
    expect(s.monthForecast.toFixed(6)).toBe((9 + (9 / 15) * 16).toFixed(6))
  })

  test('a month tracked from mid-month forecasts from the days it saw', async () => {
    const s = summarize({ since: '2026-10-11', days: { '2026-10-11': 5, '2026-10-15': 5 } }, '2026-10-15')
    expect(s.monthForecast.toFixed(6)).toBe((10 + (10 / 5) * 16).toFixed(6))
  })

  test('series gives 7 days, 30 days or 12 months, today last', async () => {
    const week = series(ledger, '2026-10-15', 'week')
    expect(week.length).toBe(7)
    expect(week.at(-1)).toMatchObject({ usd: 4, isNow: true })
    expect(week[0]?.usd).toBe(3)
    expect(series(ledger, '2026-10-15', 'month').length).toBe(30)
    const year = series(ledger, '2026-10-15', 'year')
    expect(year.length).toBe(12)
    expect(year.at(-1)).toMatchObject({ label: 'O', usd: 9 })
    expect(year.at(-2)).toMatchObject({ label: 'S', usd: 15 })
  })

  test('addDays crosses months', async () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('drawing helpers', () => {
  test('meter marks the even-pace cell', async () => {
    expect(meter(50, 10, 75)).toEqual({ filled: '━━━━━', empty: '─────', markAt: 7 })
    expect(meter(100, 4).markAt).toBeUndefined()
  })

  test('columns stack eighth blocks two rows tall', async () => {
    const [top, bottom] = columns([0, 0.5, 1, 0.01], 2)
    expect(top).toEqual([' ', ' ', '█', ' '])
    expect(bottom).toEqual([' ', '█', '█', '▁'])
  })

  test('the heartbeat scrolls while working and lies flat at rest', async () => {
    expect(ekg(0, 6, true)).not.toBe(ekg(3, 6, true))
    expect(ekg(0, 4, false)).toBe('⣀⣀⣀⣀')
  })

  test('forecast skips compactions and counts turns left', async () => {
    const f = forecast([100_000, 150_000, 40_000, 90_000], 1_000_000)
    expect(f?.perTurn).toBe(50_000)
    expect(f?.turnsLeft).toBe(18)
    expect(forecast([100_000], 1_000_000)).toBeUndefined()
  })

  test('tokens drop a trailing .0', async () => {
    expect(formatTokens(50_000)).toBe('50k')
    expect(formatTokens(12_345)).toBe('12.3k')
    expect(formatTokens(1_500_000)).toBe('1.5M')
  })

  test('money prints tighter as it grows', async () => {
    expect(formatUsd(2.414)).toBe('$2.41')
    expect(formatUsd(155.4)).toBe('$155')
    expect(formatUsd(1520)).toBe('$1.5k')
  })
})
