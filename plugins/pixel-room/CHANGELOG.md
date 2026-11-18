# Changelog

All notable changes to pixel-room. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Each release is tagged `pixel-room--v<version>`.

## [0.2.1] - 2026-11-18

### Fixed

- The room loads again on Claude Code 2.1.324 and 2.1.325. Those builds know no backdrop clicks, and 0.2.0's click hook made them refuse the whole plugin, so the room, the band and `/pixel-room` were missing. There the cat is petted with `/pixel-room pet`; from 2.1.326 a click on the room still pets it.

## [0.2.0] - 2026-11-18

### Added

- The day's weather at the window, the same all day and drawn from the date and season: rain, a fine drizzle with beaded drops, slow swaying snow with snow on the rooftops and frost in the corners, drifting fog over pale towers, or a clear sky with stars at night and a sunbeam with dust motes by day. The floor light follows it. `/pixel-room weather` says today's weather and the moon, and `/pixel-room weather rain|drizzle|snow|fog|clear` pins one until `/pixel-room weather auto`.
- The moon in its real phase, crossing the upper glass through the night, dimmer and haloed behind rain, drizzle or snow.
- Dawn, from 05:00 to 07:00: an ember and rose sky with a low sun, cooler and fresher than dusk.
- Seasons by the local date, turned around south of the equator by the time zone's name, with a small object on the bookcase for each: a snow globe, tulips, a cactus or a pumpkin.
- Fairy lights along the top of the window, glowing softly while the lamp is lit, with a slow chase along the string while Claude works.
- A corkboard on the wall whose sticky notes follow Claude's todo list or task list: done, under way and waiting, up to six with a `+` past that. With no list it holds a polaroid, a postcard and a ticket stub.
- A small calendar on the wall showing the real month and day, in a pixel font of its own.
- Moths circling the lamp, one for each subagent running, up to three.
- A monitor that shows what Claude is doing: a calm screensaver while idle, scrolling code while it works, a red line after the turn's first tool error, and a green check after a clean turn, resting to the screensaver a few minutes later.
- A woven rug under the cat and a faint pattern on the wallpaper. The lamp's light is softer and warmer, and flickers once when the cat is startled.
- Petting: click the room, or run `/pixel-room pet`, and hearts rise over the cat while it purrs, at most once every three seconds. A soft purr sound joins the chime and the low tone.
- A paper plane glides past the window after a `git push` that goes through.
- The cat's ear twitches in its sleep, its tail tip shifts, and it blinks while it watches.
- A band above the prompt in the desktop and mobile apps: a slim animated strip of the room with a tiny window, the cat on the sill, fairy lights and the session's mugs, notes, plant and moths. `/pixel-room band off` puts it away and `/pixel-room band on` brings it back. Collapsed, it reads "Pixel Room".
- On the terminal, the line that closes a turn uses the room's own word, such as "Steeped" or "Mulled", keeping the time.

### Changed

- The footer label follows the weather and the light: `snowing · lamp on`, `clear · full moon`, `drizzle · dawn`.
- The working line's phrases follow the weather, the time and what is going on ("Snow on the sill", "Moon over the city", "First light", "Moths at the lamp", "Ticking off a note"), still one phrase per turn for each thing the turn does.
- `/pixel-room` describes the weather, the moon, the lamp, the cat, the notes and the moths.
- The room card's window shows the day's weather and the moon, fairy lights hang over its portrait at night, and the full card gains a small corkboard while a list runs. Its widget opens by itself only while the band is put away, since the band now takes its place; `/pixel-room card` still opens it.
- Changes to the notes and the moths share one redraw of the backdrop every few seconds at most, so a busy turn never redraws it on every tool call.
- It stores two more settings, the pinned weather and whether the band is put away, and `forget` deletes them too.

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

[0.2.1]: https://github.com/Samarth2001/claude-plugins/releases/tag/pixel-room--v0.2.1
[0.2.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/pixel-room--v0.2.0
[0.1.0]: https://github.com/Samarth2001/claude-plugins/releases/tag/pixel-room--v0.1.0
