# Changelog

All notable changes to light-leak. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `light-leak--v<version>`.

## [0.1.2] - 2026-11-23

### Fixed

- Trying Light Leak or changing its glass from the themes picker no longer adds a `/light-leak` line and its reply to the chat. It hears the picker through the picker's own state and acts on its request directly; `/light-leak` typed by hand works as before.

## [0.1.1] - 2026-11-22

### Fixed

- `/light-leak off` and `/light-leak forget` clear the session's theme only while it is Light Leak's, so they no longer take down another theme that showed after it.
- Installed beside another theme and never turned on by name, Light Leak no longer covers it at every start: it yields to a theme already showing, and `/light-leak on` puts it in place and keeps that choice. While another theme shows, a glass change, a clear, a resume or a fork no longer sets Light Leak over it.
- `/light-leak` names why it isn't drawn: no window here, another theme showing, or held back by the themes picker, instead of always saying this window draws no backdrops.
- In a desktop session left open for days, the noise no longer coarsens into blocky patches: the drift now runs on a bounded phase.
- The shader no longer sweeps through daylight colours at midnight, and a long session's counts no longer burst when they pass 1,023: night and warmth come from the clock as smooth values, and each count turns at its top instead of wrapping.
- A turn started without a typed message, such as a continuation or a wake-up, no longer plays the message-sent glow.

## [0.1.0] - 2026-11-20

### Added

- A dark film frame behind the conversation in the desktop app, drawn on the GPU at 30 fps: warm light seeping in at the lower left corner, a fainter wash down the right edge, and a fine grain that holds still.
- The light follows Claude's work: it breathes in brighter while Claude works, swells a little with each tool call, turns rose after a failed one, washes in from the right when a turn ends and rises from the foot when you send a message. Warmth pools under the prompt box, and gathers faintly toward the pointer.
- The hour from your computer's clock: amber by day, rose-amber at dawn and dusk, deeper at night.
- A still picture of the same frame, by day and by night, for the mobile app, Reduce Motion, builds before 2.1.326 and wherever the shader can't play.
- The app's colours from the frame: brown-black grays, a soft amber accent, an ochre for warnings, a dusty rose for errors, a sage green for success and a mauve for pro.
- `/light-leak` says how it stands, with `on`, `off`, `glass clear|soft|frosted` and `forget` to delete what it kept.

[0.1.2]: https://github.com/Samarth2001/claude-plugins/releases/tag/light-leak--v0.1.2
[0.1.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/light-leak--v0.1.1
[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/light-leak--v0.1.0
