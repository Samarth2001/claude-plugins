# Changelog

All notable changes to pixel-room. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `pixel-room--v<version>`.

## [0.1.0] - 2026-11-17

### Added

- A late-night pixel room behind the conversation in the desktop and mobile apps, drawn on one pixel grid in a palette of 17 colours with ordered dithering:
  - a tall rainy window with a city behind it, fast streaks outside and slow drops running down the glass, and its light falling across the floorboards with the rain's shadows sliding through it
  - a low bookcase with a candle
  - a desk with a monitor of slowly scrolling code, a steaming mug, a notebook and a desk lamp
  - a trailing plant on a wall shelf
  - a wall clock that keeps the local time

  The room keeps to the edges and the bottom, so the middle stays calm.
- An orange tabby cat in five poses:
  - asleep on the sill, breathing, with drifting z's, while Claude is idle
  - pacing the floor in a four-frame walk while a turn runs
  - sitting up to watch, tail flicking, from the turn's first tool call
  - startled, ears back and tail on end, at the turn's first tool error
  - stretching before it curls up when a turn ends clean

  It moves at most four times a turn, and subagents leave it alone.
- Day, dusk and night from the local clock. The lamp lights from dusk, casting a warm dithered cone and glow, and the app's colours turn warmer. By day the window is grey-blue and the room cooler.
- App colours drawn from the room's palette: plum and ink surfaces, lamp amber accent, the cat's orange for warnings, the plant's green for success, with frosted panels over the scene.
- The working line speaks of the room ("The cat is pacing", "Rain on the glass"), one phrase per turn. In the desktop app only its plain "Working" is replaced, and a message shown there is never changed.
- One footer label, such as `raining · lamp on`.
- A room card: a framed pixel portrait of the cat in its pose with a line on what it is doing, and three instruments for the session: mugs that fill as turns finish, a cassette whose tape winds on with each turn, and a plant that perks up or droops with test runs. It opens by itself as a small widget in the desktop app, once a session, and as plain text in the terminal when asked.
- A soft chime when a turn ends clean and a soft low tone when it fails. Sounds play on macOS; a Linux or Windows terminal plays none.
- `/pixel-room` describes the room. Its arguments:
  - `card`, `card off` and `card on` open the card or put it away
  - `mute` and `unmute` turn the sounds off and back on
  - `off` and `on` turn the whole room off and back on
  - `glass clear`, `soft` or `frosted` sets how much veil sits between the room and the chat; soft is the default
  - `forget` deletes its settings, for a clean removal

  Only those three settings are stored.
- Square and tall windows move the window and the desk toward the middle. Reduced motion shows the room and the card still.

[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/pixel-room--v0.1.0
