# Changelog

All notable changes to real-sky. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `real-sky--v<version>`.

## [0.1.0] - 2026-11-17

### Added

- A sky almanac behind the conversation in the desktop and mobile apps: a graded sky with a fine grain that follows your local clock through dawn from 05:00, day from 08:00, dusk from 17:00 and night from 20:00.
- One hairline arc across the upper sky with a tick for each hour, the hours gone solid and those to come dotted. The sun rides it from 05:00 to 20:00 as a small disc with a thin ring; at night the moon rides it in its real phase, worked out from the date, its dark side faintly lit.
- Sparse stars after dark, a few of them slowly twinkling, and a low, misty horizon: layered hills, paler with distance, a slender far-off skyline, a tower crane and a mast with a slow red light, with windows lit at dusk and through the night.
- Two faint lines of annotation in the top-left corner: the part of the day, the time, the weather and, after dark, the moon's phase.
- An arc for wide, square and tall phone windows, each kept clear of the middle and the foot.
- Weather that follows the session: thin cirrus when clear, by default and after a clean turn or a passing test run; layered stratus after an error; heavier bands, fine rain and a cloud band that brightens with lightning after three errors in a turn or a failing test run. Worse weather shows at once; the sky clears at the end of a turn.
- Muted app colors for each part of the day, the surfaces barely tinted and a few percent apart, the accent taken from that hour's sun or moon, each with frosted glass of its own.
- A spinner phrase from the sky, sampled once a turn, such as "Watching the light go" at dusk or "Riding out the storm". A message the app sets stands, and so does a desktop step's own description.
- A footer label among the session's modes, such as `dusk · clear`.
- An almanac card: the sun's path in miniature with now marked, the hour, the four parts of the day on one line, the moon's phase, and a session barometer whose needle falls with errors and rises with clean turns, a set hand at where the turn began, and a one-line forecast. It opens as a compact widget once a session in the desktop app, and draws as text in the terminal.
- `/real-sky` reads the almanac in a few lines; `/real-sky almanac` opens the card and `almanac off` and `on` keep the choice; `/real-sky off` and `on` turn the sky off and back; `dawn`, `day`, `dusk` and `night` pin a part of the day and `auto` follows the clock again.
- Reduced motion stills the cirrus, rain, stars and the mast's light, and drops the lightning.

[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/real-sky--v0.1.0
