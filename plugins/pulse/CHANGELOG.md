# Changelog

All notable changes to pulse. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `pulse--v<version>`.

## [0.1.0] - 2026-10-03

### Added

- A one-line glance above the prompt: a heartbeat trace that scrolls while Claude works, the turn's clock and tool count, a context sparkline, plan limit meters with an even-pace mark and the 5-hour reset countdown, and spend for this session, today and this month.
- `more` expands the band into four tabs (hotkeys `1` to `4`): Context (fill, tokens, last turn's jump, average growth, turns left, cache hit), Limits (meters, reset times, pace ratio, where each window lands at reset or when it fills), Cost (a bar chart over 7 days, 30 days or 12 months, today, 7 days, this month, a month-end forecast, last month, daily average, session tokens) and Turns (recent turns with duration, tools, context growth, cost and cache hit, plus the session's tool mix).
- `/pulse` opens a dashboard pane with every section at once.
- A spend ledger in the plugin's store, kept per session and per local day so sessions running side by side don't overwrite each other; days older than 400 days are pruned.
- A value that just changed glows for a moment; a toast when a plan limit crosses 80% and 95%.
- `/pulse glance`, `/pulse detail`, `/pulse context|limits|cost|turns`, `/pulse hide`, `/pulse show`. The band's mode, tab and range are remembered across sessions.
