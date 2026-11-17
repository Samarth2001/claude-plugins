# Changelog

All notable changes to constellation. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `constellation--v<version>`.

## [0.1.0] - 2026-11-17

### Added

- A night sky behind the conversation in the desktop and mobile apps: a deep indigo ground, a faint galactic band with an uneven dark lane, a fixed field of background stars that twinkle slowly, and dark colors for the app with frosted panels over the scene.
- Every file Claude edits becomes a star, placed in a cluster with the rest of its folder and colored by its file type; it grows brighter with each doubling of its edits and wears diffraction spikes from nine edits, so the few busy files stand out. Files only read are faint dust stars.
- Nearby files edited in the same turn join into a constellation, its lines stopping short of the stars as in a star atlas. Files far apart form separate figures rather than one long line, figures never cross, and a lone far file stays unlinked. The five newest are named under their largest figure after their folder, and the six brightest stars carry their file names.
- The sky changes at the end of each turn: new stars ignite, new lines draw themselves, then it rests. A turn whose tests passed ends with a meteor. Reduced motion shows the sky finished and still.
- One sky per project, kept in the plugin's store across sessions, up to 400 stars and 48 constellations. Only file paths and counts are stored.
- `/constellation glass clear`, `soft` or `frosted` sets how much veil sits between the sky and the chat. Soft is the default.
- `/constellation` summarizes the sky; `/constellation off`, `on` and `reset` turn it off, bring it back and clear this project's sky; `/constellation forget` deletes everything it stored, for a clean removal.

[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/constellation--v0.1.0
