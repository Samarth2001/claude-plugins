# Pulse

A live usage cockpit above the Claude Code prompt, one row tall. It shows how full the context is, how fast you're burning your plan limits and what you've spent. Press any label to open a one-row drawer with the detail behind it.

```
⡠⠊⠑⢄⣀⣀ 12s · 3 tools   ctx ▂▃▄▅ 46%   5h ━━─┼── 23% ↻2h00m   7d ━━━╋━─ 81%   cost $4.30 · Oct $41.10   ▾
```

The gauges are drawn, not typed. In the terminal they're colored cell grids: a heartbeat whose bright head trails off as it scrolls, meters that run from green to red, and bar charts. In the desktop app and VS Code they're small animated SVGs: a scrolling pulse with a ripple, a context ring, capsule meters that slide to a new value, and charts that grow in.

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install pulse@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

Pulse replaces buddy. If you had `buddy@samarth` installed, Claude Code (v2.1.193 or later) moves it to `pulse@samarth` the next time it updates the marketplace; run `/plugin install pulse@samarth` once if it reports the plugin is not cached. It draws with plain text, so it works in the terminal, the desktop app's Code tab, VS Code and mobile.

## What it shows

### The row

| Part | What |
| --- | --- |
| Heartbeat | Scrolls while a turn runs, with the turn's clock and tool count; a flat line when idle |
| `ctx` | A sparkline of context per turn (terminal) or a ring (desktop), then the fill now |
| `5h`, `7d` | Each plan limit as a heat meter with a tick where an even pace would be by now, the percent used, and the 5-hour reset countdown. The color follows where the window is heading |
| `cost` | This session, and this month across every session on this machine |

Below 120 columns the row drops the reset time and the month; below 84 it keeps only the numbers.

### Drawers

Press a label to open its drawer under the row; press it again, or `▴`, to close it. A drawer is one row, or two on narrower screens.

| Label | Drawer |
| --- | --- |
| `idle` | Turns as a timeline, each as wide as it took, the last turn's time, tools and cost, and the tool mix |
| `ctx` | Context per turn as an area chart, tokens of the window, the last turn's jump, growth per turn, turns left, cache hit, the model |
| `5h`, `7d` | Wide meters, pace (`1.9×` burns almost twice as fast as even), where each window lands at reset or when it fills, and when it resets |
| `cost` | Spend as bars over 7 days, 30 days or 12 months, with today, 7 days, this month and a month-end forecast; then this session, the daily average and last month |

`⤢` opens every drawer at once, larger, in a pane (`/pulse` does too).

A number that just changed glows for a moment, and its meter slides from the old value on desktop. When a plan limit crosses 80% or 95%, a toast says so once.

## Controls

| Control | Does |
| --- | --- |
| A label (`idle`, `ctx`, `5h`, `7d`, `cost`) | Open or close its drawer |
| `▾` / `▴` | Open the last drawer, or close it |
| `7d`, `30d`, `12mo` | Pick the cost chart's range |
| `⤢` or `/pulse` | Open the dashboard pane |
| `/pulse context` (or `limits`, `cost`, `turns`) | Open that drawer |
| `/pulse glance`, `/pulse detail` | Close or open the drawer |
| `/pulse hide`, `/pulse show` | Hide or bring back the row. On desktop an open drawer also has `hide`; the terminal draws its own `[-]` |

In the terminal, the band takes the keyboard after ctrl+x tab or a click; Tab walks the labels and Enter presses one. The open drawer and the chart range are remembered across sessions.

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

`hooks/calc.ts` holds the pure math (pace, ledger sums, colors), `hooks/widgets.tsx` the gauges and charts for each surface, `hooks/draw.tsx` the row, drawers and pane, and `hooks/register.tsx` the events and state.

See [CHANGELOG.md](CHANGELOG.md) for releases.
