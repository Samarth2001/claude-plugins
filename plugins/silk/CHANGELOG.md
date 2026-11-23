# Changelog

All notable changes to silk. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `silk--v<version>`.

## [0.1.2] - 2026-11-23

### Fixed

- Trying Silk or changing its glass from the themes picker no longer adds a `/silk` line and its reply to the chat. It hears the picker through the picker's own state and acts on its request directly; `/silk` typed by hand works as before.

## [0.1.1] - 2026-11-22

### Fixed

- `/silk off` and `/silk forget` clear the session's theme only while it is Silk's, so they no longer take down another theme that showed after it.
- Installed beside another theme and never turned on by name, Silk no longer covers it at every start: it yields to a theme already showing, and `/silk on` puts it in place and keeps that choice. While another theme shows, a glass change, a clear, a resume or a fork no longer sets Silk over it.
- `/silk` names why it isn't drawn: no window here, another theme showing, or held back by the themes picker, instead of always saying this window draws no backdrops.
- In a desktop session left open for days, the noise no longer coarsens into blocky patches: the drift now runs on a bounded phase.
- The shader no longer sweeps through daylight colours at midnight, and a long session's counts no longer burst when they pass 1,023: night and warmth come from the clock as smooth values, and each count turns at its top instead of wrapping.
- The ripple after a tool call is lit evenly all round: its slope is taken from the true distance to the prompt.

## [0.1.0] - 2026-11-20

### Added

- A graphite satin backdrop for the desktop app, drawn on the GPU at 30 fps: long folds under one soft sheen, lit from the upper left and steered by the pointer.
- Reactions to the main conversation: the folds drift faster while Claude works, a tool call sends a low wave through the cloth, an error warms the sheen toward rose, and a finished turn draws a band of light across it.
- A violet cast from evening to early morning, read from the local clock every ten minutes.
- A still picture of the cloth, by day and by night, for the mobile app, Reduce Motion, builds before 2.1.326 and wherever the shader can't run.
- A dark palette of graphite grays with a faint cool tint, a silver-blue accent and muted roles, set when a session starts.
- `/silk` with `on`, `off`, `glass clear|soft|frosted` and `forget`.

[0.1.2]: https://github.com/Samarth2001/claude-plugins/releases/tag/silk--v0.1.2
[0.1.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/silk--v0.1.1
[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/silk--v0.1.0
