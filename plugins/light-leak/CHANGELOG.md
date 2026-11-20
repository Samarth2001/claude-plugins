# Changelog

All notable changes to light-leak. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `light-leak--v<version>`.

## [0.1.0] - 2026-11-20

### Added

- A dark film frame behind the conversation in the desktop app, drawn on the GPU at 30 fps: warm light seeping in at the lower left corner, a fainter wash down the right edge, and a fine grain that holds still.
- The light follows Claude's work: it breathes in brighter while Claude works, swells a little with each tool call, turns rose after a failed one, washes in from the right when a turn ends and rises from the foot when you send a message. Warmth pools under the prompt box, and gathers faintly toward the pointer.
- The hour from your computer's clock: amber by day, rose-amber at dawn and dusk, deeper at night.
- A still picture of the same frame, by day and by night, for the mobile app, Reduce Motion, builds before 2.1.326 and wherever the shader can't play.
- The app's colours from the frame: brown-black grays, a soft amber accent, an ochre for warnings, a dusty rose for errors, a sage green for success and a mauve for pro.
- `/light-leak` says how it stands, with `on`, `off`, `glass clear|soft|frosted` and `forget` to delete what it kept.

[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/light-leak--v0.1.0
