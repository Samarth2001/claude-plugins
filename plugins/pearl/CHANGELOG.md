# Changelog

All notable changes to pearl. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `pearl--v<version>`.

## [0.1.1] - 2026-11-22

### Fixed

- `/pearl off` and `/pearl forget` clear the session's theme only while it is Pearl's, so they no longer take down another theme that showed after it.
- Installed beside another theme and never turned on by name, Pearl no longer covers it at every start: it yields to a theme already showing, and `/pearl on` puts it in place and keeps that choice. While another theme shows, a glass change, a clear, a resume or a fork no longer sets Pearl over it.
- `/pearl` names why it isn't drawn: no window here, another theme showing, or held back by the themes picker, instead of always saying this window draws no backdrops.
- In a desktop session left open for days, the noise no longer coarsens into blocky patches: the drift now runs on a bounded phase.
- The shader no longer sweeps through daylight colours at midnight, and a long session's counts no longer burst when they pass 1,023: night and warmth come from the clock as smooth values, and each count turns at its top instead of wrapping.
- A message you send now sends a wide, faint ring of sheen out from the prompt, as the comment and the README say. The send was counted, but the shader never drew it.

## [0.1.0] - 2026-11-20

### Added

- A muted, pearly sheen behind the conversation in the desktop app, drawn on the GPU at 30 fps: soft patches of faint green, lilac and rose blended with grey, drifting over near-black.
- It follows Claude's main loop. The sheen deepens and drifts a little faster while Claude works, a faint ring spreads from the prompt with each tool call, a tool error turns it a muted copper for a moment, and a slow, wide ring moves outward when a turn ends. Subagents leave it alone.
- Your pointer turns the sheen into a slow swirl.
- From dusk the ground darkens toward night, by the local clock.
- A still picture of the sheen for the mobile app, Reduce Motion, builds before 2.1.326 and anywhere the shader can't run, with a deeper, cooler variant at night.
- App colours from the sheen's own numbers: cool grays with a trace of lilac, a pale pearl-lilac accent, a rose red, a jade, a copper amber and a quiet violet.
- `/pearl` says how it stands. `on` and `off` turn it on and off, `glass clear`, `soft` or `frosted` sets how much veil sits between the sheen and the chat (soft is the default), and `forget` deletes its settings, for a clean removal. Only the off switch and the glass are stored.

[0.1.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/pearl--v0.1.1
[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/pearl--v0.1.0
