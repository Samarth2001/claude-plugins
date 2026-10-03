# Changelog

All notable changes to pulse. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `pulse--v<version>`.

## [0.1.0] - 2026-10-03

Replaces buddy, which is removed from the marketplace. Existing buddy installs move to pulse on their own (Claude Code v2.1.193 or later).

### Added

- One slim row above the prompt: a heartbeat with the turn's clock and tool count, context, each plan limit with a meter and an even-pace tick, and spend for the session and the month.
- Drawn gauges on every surface: colored cell grids in the terminal (a fading heartbeat trace, green-to-red meters, bar and area charts) and small animated SVGs on desktop and VS Code (a scrolling pulse with a ripple, a context ring, capsule meters that slide to new values, charts that grow in).
- Press a label to open a one-row drawer: turns as a timeline with the tool mix; context per turn with growth, turns left and cache hit; plan limits with pace and where each lands at reset; spend as bars over 7 days, 30 days or 12 months with a month-end forecast.
- `/pulse` or `⤢` opens a dashboard pane with every drawer, larger.
- A spend ledger in the plugin's store, kept per session and per local day so sessions running side by side don't overwrite each other; days older than 400 days are pruned.
- A value that just changed glows for a moment; a toast when a plan limit crosses 80% and 95%.
- `/pulse context|limits|cost|turns`, `/pulse glance`, `/pulse detail`, `/pulse hide`, `/pulse show`. The open drawer and chart range are remembered across sessions.
