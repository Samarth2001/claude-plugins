# HUD

A live usage cockpit above the Claude Code prompt, one row across the full width. It shows how full the context is, how fast you're burning your plan limits and what you've spent. Press any label to open a drawer with the detail behind it.

```
✶ working 12s · 3 tools   ◑ context ▰▰▰▰▱▱▱▱▱▱ 46%   ◷ 5-hour ▰▰▮▱▱▱▱▱▱▱ 23% │ ↻ 2h00m   ▦ weekly ▰▰▰▰▰▰▰▰▱▱ 81%   ↑ 954k ↓ 3.0k   $ $4.30 │ Oct $41.10   ⤢ ▾
```

Each metric has its own icon and color: Claude's own spinner in clay and a shimmering "working" while Claude runs, a pie that fills with the context window, a clock for the 5-hour limit, a calendar for the weekly one, tokens in and out, and spend. The metrics sit on the left at even spacing, with the controls at the right edge. Names stay dim until their drawer opens.

On the desktop app and VS Code the row is flat and one line tall: each metric wears a small lit icon tile in its color (a breathing dot at rest, a spinning arc and a scrolling heartbeat while Claude works, a pie that fills, a clock whose hand sweeps, a calendar with today lit, a coin with a passing glint), labels stay muted until their drawer opens, and meters are rounded capsules with a heat gradient that slide to each new reading. Charts in the drawers and the pane are drawn as vectors, so they line up. In the terminal the same row is drawn in colored cells: segmented meters, a spinner and a shimmer. Tints follow your theme, light or dark.

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install hud@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

HUD replaces buddy. If you had `buddy@samarth` installed, Claude Code (v2.1.193 or later) moves it to `hud@samarth` the next time it updates the marketplace; run `/plugin install hud@samarth` once if it reports the plugin is not cached. It works in the terminal, the desktop app's Code tab and VS Code.

## What it shows

### The row

| Part | What |
| --- | --- |
| `✻ idle` / `✶ working` | Claude's spinner, a shimmer, the turn's clock and tool count while Claude works; `idle` at rest |
| `◑ context` | A pie and a meter of how full the context window is, then the percent |
| `◷ 5-hour`, `▦ weekly` | Each plan limit as a heat meter, the percent used and the time to reset (`↻`). A bright notch ahead of the fill marks where an even pace would be by now; no notch means you're ahead of it, and the color says where the window is heading |
| `↑ ↓` | Tokens in and out this session, when the row is wide |
| `$` | This session, and this month across every session on this machine |

The row picks the richest layout that fits: names, meters, reset times, tokens and the month when wide; then fewer extras; then icons with meters; then icons with numbers. On a narrow row, press a chip's icon to open its drawer. The open drawer's name shows at full strength, so you can see which one is open.

### Drawers

Press a chip to open its drawer under the row; press it again, or `▴`, to close it. A drawer is a short table, each row named with its chip's icon.

| Label | Drawer |
| --- | --- |
| `idle` | Turns as a timeline, each as wide as it took, the last turn's time, tools and cost, and the tool mix |
| `context` | A wide meter, tokens of the window and the last turn's jump; then a per-turn sparkline, growth per turn, turns left, cache hit and the model |
| `5-hour`, `weekly` | Wide meters, pace (`1.9×` burns almost twice as fast as even), where each window lands at reset or when it fills, and when it resets |
| `spent` | Spend as bars over 7 days, 30 days or 12 months, with today, 7 days, this month and a month-end forecast; then this session, the daily average and last month |

`⤢` opens every drawer at once, larger, in a pane (`/hud` does too).

A number that just changed glows for a moment, and its meter slides from the old value. When a plan limit crosses 80% or 95%, a toast says so once.

## Controls

| Control | Does |
| --- | --- |
| A chip's name, or its icon on a narrow row | Open or close its drawer |
| `▾` / `▴` | Open the last drawer, or close it |
| `7d`, `30d`, `12mo` | Pick the cost chart's range |
| `⤢` or `/hud` | Open the dashboard pane |
| `/hud context` (or `limits`, `cost`, `turns`) | Open that drawer |
| `/hud glance`, `/hud detail` | Close or open the drawer |
| `/hud hide`, `/hud show` | Hide or bring back the row; plain `/hud` also brings it back. On desktop an open drawer also has `hide band`; the terminal draws its own `[-]` |

In the terminal, the band takes the keyboard after ctrl+x tab or a click; Tab walks the labels and Enter presses one. The open drawer and the chart range are remembered across sessions.

## Where the numbers come from

- Context, plan limits and session cost are Claude Code's own figures, the ones `/cost` and the status line use: `$.session.usage()` and the `session.measure` event.
- Pace and forecasts are straight-line estimates: used over elapsed for the 5-hour and 7-day windows, average growth over the last few turns for context, and this month's spend so far for the month end.
- Spend by day, week and month is HUD's own ledger. Each time a session's cost grows, HUD adds the difference to that day in its store, under a key per session. It counts only sessions that ran with HUD installed, on this machine, from the day shown as "tracked here since". It is not your billing statement.
- Token totals and cache hit come from each turn's usage on `turn.complete`, subagents included.

## Develop

From the repository root:

```bash
claude plugin validate plugins/hud
claude plugin test plugins/hud
claude --plugin-dir plugins/hud     # try it, hot-reloads on save
```

`hooks/calc.ts` holds the pure math (pace, ledger sums, colors), `hooks/widgets.tsx` the gauges and charts for each surface, `hooks/draw.tsx` the row, drawers and pane, and `hooks/register.tsx` the events and state.

See [CHANGELOG.md](CHANGELOG.md) for releases.
