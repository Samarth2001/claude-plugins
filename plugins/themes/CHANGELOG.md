# Changelog

All notable changes to themes. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `themes--v<version>`.

## [0.2.1] - 2026-11-18

### Fixed

- A tidier band: each tile's title and author sit centred under its picture, the page arrows sit either side of the page count, and Cancel and Keep stay at the right, apart from the theme's options and Remove.

## [0.2.0] - 2026-11-18

### Removed

- Constellation and Real Sky, which have left the marketplace. The picker lists Pixel Room and Anthropic's twenty scenes.

## [0.1.1] - 2026-11-17

### Fixed

- A session's start no longer runs theme commands into the transcript. Where a theme is kept, another installed theme that sets itself at the start is held back, so it never draws, and nothing is turned off by command. A theme you turn on yourself, from the picker or by typing its command, is let through.

## [0.1.0] - 2026-11-17

### Added

- `/themes` opens a band above the prompt with a strip of every theme: a small picture and its title on the desktop and mobile apps, a line of text on the terminal, each tagged with who built it. ✓ marks the theme that is on, and ‹ › page through the tiles when they don't fit.
- Picking a tile tries the theme live, turning the one that was on off first. Keep keeps it and closes the band; Cancel puts back what was on.
- The picked theme's options under the strip, each running the theme's own command: each of Samarth's themes' glass, Real Sky's part of the day and almanac, Pixel Room's card and sound, Constellation's reset after a yes, and the scope an Anthropic scene is kept for. An option set by typing the theme's own command, such as `/pixel-room glass clear`, shows in the band as set, and a typed `forget` clears what the band showed for that theme.
- Install and Remove from the band. Remove turns the theme off and deletes what it stored before uninstalling it; where `claude` can't run from the session, the band shows the command to run.
- Samarth's three themes and the twenty scenes of Anthropic's `theme-examples`, listed in one catalog file where adding a theme is one entry.
- `/themes <name>` switches and keeps a theme, `/themes list` lists them with their authors, and `/themes off` turns the theme off.
- At a session's start, where the kept theme is on alongside another, the other is turned off.

[0.2.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/themes--v0.2.1
[0.2.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/themes--v0.2.0
[0.1.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/themes--v0.1.1
[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/themes--v0.1.0
