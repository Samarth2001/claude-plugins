# Pulse

A live usage cockpit above the Claude Code prompt. One quiet line tells you how full the context is, how fast you are burning your plan limits, and what you have spent today and this month. Press `more` and it opens into tabs with the detail behind each number.

```
⡠⠊⠑⢄⣀⣀ 12s · 3 tools  │  ctx ▂▃▃▄ 42%  │  5h ━━─┃── 23% ↻2h00m  │  7d ━━┃━━─ 81%  │  $2.07 · today $4.47 · Oct $24.37   ▾ more
```

Expanded, on the Limits tab:

```
1: Context  2: Limits  3: Cost  4: Turns                                       p: dashboard
5h    ━━━━━━━───────────┃───────────   23%  resets in 2h00m  ·  0.4x pace → 38% at reset
7d    ━━━━━━━━━━━━┃━━━━━━━━━━━──────   81%  resets in 4d 0h  ·  1.9x pace · full in ~16h53m
┃ marks an even pace through the window
```

On the Cost tab:

```
       ██       ▃▃     session $2.07  today $4.47  7d $24.37
    ▂▂ ██    ▅▅ ██ ██  Oct $24.37  → ~$50.36 by month end  last month $40.00
Fr Sa Su Mo Tu We Th   avg $3.48/day · tracked here since Sep 2
tokens in 1.2M · out 84k · cache hit 91% · subagents 22%
```

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install pulse@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

Pulse replaces buddy. If you had `buddy@samarth` installed, Claude Code (v2.1.193 or later) moves it to `pulse@samarth` the next time it updates the marketplace; run `/plugin install pulse@samarth` once if it reports the plugin is not cached. It draws with plain text, so it works in the terminal, the desktop app's Code tab, VS Code and mobile.

## What it shows

### The glance row

| Part | What |
| --- | --- |
| Heartbeat | Scrolls while a turn runs, flat when idle. Beside it, the turn's clock and tool count |
| `ctx` | A sparkline with one bar per turn, then the context fill now |
| `5h`, `7d` | Each plan limit as a meter with `┃` where an even pace would be by now, the percent used, and the time until the 5-hour window resets. The color follows where the window is heading, not only where it is |
| Money | This session, today, and this month across every session on this machine |

The row drops the meters below 120 columns, and keeps only the numbers below 84. Below 90 columns the Cost tab's range buttons move from the tab strip to the top of the tab.

### The tabs

| Tab | Shows |
| --- | --- |
| Context | Fill, tokens of the window, the last turn's jump, average growth per turn, turns left at that rate, the last turn's cache hit, the model |
| Limits | A wide meter per window, reset time, pace (`1.9x` is burning almost twice as fast as even), and where it lands at reset or when it fills |
| Cost | Bars over 7 days, 30 days or 12 months; session, today, 7 days, this month, a month-end forecast, last month, average per day; the session's tokens in and out, cache hit and the subagents' share |
| Turns | Recent turns: duration as a bar, tools, context growth, cost and cache hit; then the session's tool mix |

A number that just changed glows for a moment. When a plan limit crosses 80% or 95%, a toast says so once.

## Controls

| Control | Does |
| --- | --- |
| `▾ more` / `▴ less` (`e`) | Expand or collapse the band |
| `Context`, `Limits`, `Cost`, `Turns` (`1` to `4`) | Pick a tab |
| `7d`, `30d`, `12mo` (`w`, `m`, `y`) | Pick the Cost chart's range |
| `dashboard` (`p`) or `/pulse` | Open every section in a pane |
| `/pulse glance`, `/pulse detail` | Set the band's size |
| `/pulse context` (or `limits`, `cost`, `turns`) | Expand on that tab |
| `/pulse hide`, `/pulse show` | Hide or bring back the band. On desktop the expanded band also has `hide`; the terminal draws its own `[-]` |

Hotkeys work while the band has focus (ctrl+x tab, or a click). The mode, tab and range are remembered across sessions.

## Where the numbers come from

- Context, plan limits and session cost are Claude Code's own figures, the ones `/cost` and the status line use: `$.session.usage()` and the `session.measure` event.
- Pace and forecasts are straight-line estimates: used over elapsed for the 5-hour and 7-day windows, average growth over the last few turns for context, and this month's spend so far for the month end.
- Spend by day, week and month is pulse's own ledger. Each time a session's cost grows, pulse adds the difference to that day in its store, under a key per session. It counts only sessions that ran with pulse installed, on this machine, from the day shown as "tracked here since". It is not your billing statement.
- Token totals and cache hit come from each turn's usage on `turn.complete`, subagents included.

## Develop

From the repository root:

```bash
claude plugin validate plugins/pulse
claude plugin test plugins/pulse
claude --plugin-dir plugins/pulse     # try it, hot-reloads on save
```

`hooks/calc.ts` holds the pure math (pace, ledger sums, charts), `hooks/draw.tsx` the rows, and `hooks/register.tsx` the events and state.

See [CHANGELOG.md](CHANGELOG.md) for releases.
