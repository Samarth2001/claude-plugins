# Changelog

All notable changes to buddy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `buddy--v<version>`.

## [0.3.0] - 2026-10-01

### Changed

- Redrawn as a pixel-art mochi with a sprout on its head, the same sprite on every surface: half-block cells in a terminal `Raster`, crisp rects with SMIL frame swaps in the desktop `Svg`.
- The sprout is the context gauge: green, then yellow from 50%, orange from 75% (buddy sweats), brown and wilted from 90%.
- Each mood has its own prop and motion: a firefly while ready, thought bubbles, an open book, a pencil, a tiny terminal, a spinning globe, a helper mochi hopping off, a gear, sparkles, a red `!`, floating z's.
- The band is a four-line HUD: what buddy is doing, a context sparkline with one bar per turn and the last turn's jump, usage limit meters with reset times, cost, files edited and the model.
- Session state lives in `$.state` instead of module variables, so a hot reload keeps it.

### Added

- `compact` button and `/buddy compact` / `/buddy full`: a two-line band with just the face; the choice is remembered across sessions. Narrow terminals switch to it on their own.
- `/buddy` toggles buddy on and off.
- The `done` line says how long the turn took and how many tools it used.

### Fixed

- The desktop SVG no longer draws on a white box in a dark app (`color-scheme` on the SVG root keeps its sandboxed frame transparent).
- A subagent finishing no longer ends the main turn's animation.

## [0.2.0] - 2026-10-01

### Changed

- Quiet glyph faces in the terminal and a small pebble SVG on desktop; essentials-only stats.

## [0.1.0] - 2026-10-01

### Added

- First release: an animated companion above the prompt with context, usage limits, cost and turn stats.

[0.3.0]: https://github.com/Samarth2001/claude-plugins/compare/59fce6a...buddy--v0.3.0
[0.2.0]: https://github.com/Samarth2001/claude-plugins/commit/59fce6a
[0.1.0]: https://github.com/Samarth2001/claude-plugins/commit/bb77862
