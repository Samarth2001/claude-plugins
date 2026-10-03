# Changelog

All notable changes to HUD. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `hud--v<version>`.

## [0.1.0] - 2026-10-03

Replaces buddy, which is removed from the marketplace. Existing buddy installs move to HUD on their own (Claude Code v2.1.193 or later).

### Added

- One flat row above the prompt, metrics on the left at even spacing and controls at the right, each with its own icon and color: in the terminal, Claude's own spinner and a shimmer in clay while Claude works, a pie for context, a clock for the 5-hour limit, a calendar for the weekly one, tokens in and out, and spend. The row picks the richest layout that fits, down to icons and numbers. Colors follow the theme, light or dark; a name stays dim until its drawer opens.
- On desktop and VS Code, a flat one-line row: each metric wears a small lit icon tile in its hue, labels stay muted until their drawer opens, and gradient capsule meters slide to each new reading. Drawers and the pane draw their charts as vectors (rounded bars with their labels, an area sparkline, a turn timeline), so they line up in a proportional font. In the terminal, colored cells: segmented meters with an even-pace notch, a spinner and shimmer. Drawers use sparklines, a turn timeline and bar charts, and wrap whole items on narrow screens.
- Press a chip to open its drawer, a short table whose rows wear their chip's icon: turns as a timeline with the tool mix; context per turn with growth, turns left and cache hit; plan limits with pace and where each lands at reset; spend as bars over 7 days, 30 days or 12 months with a month-end forecast.
- `/hud` or `⤢` opens a dashboard pane with every drawer, larger; `/hud` also brings back a hidden band.
- A spend ledger in the plugin's store, kept per session and per local day so sessions running side by side don't overwrite each other; days older than 400 days are pruned.
- A value that just changed glows and fades back; a toast when a plan limit crosses 80% and 95%.
- `/hud context|limits|cost|turns`, `/hud glance`, `/hud detail`, `/hud hide`, `/hud show`. The open drawer and chart range are remembered across sessions.

[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/hud--v0.1.0
