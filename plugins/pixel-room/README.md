# Pixel Room

A late-night pixel room behind the conversation in the Claude desktop app. The day's weather falls past a tall window, the moon crosses it at night, fairy lights glow along its frame, a desk lamp lights at dusk, and an orange cat sleeps on the windowsill until Claude starts working. Then it gets up and paces, sits to watch while tools run, jumps at an error, and stretches before curling up again when the turn ends clean. Click it and it purrs. Claude's todo list hangs on a corkboard as sticky notes, and its subagents circle the lamp as moths. The room is drawn in one small palette of 17 colours, and the app's own colours, the working line, the footer and a small room card all come from it.

![A pixel room at night: rain and the moon at a tall window under fairy lights, an orange cat sitting up on the rug to watch, a lit desk lamp with a moth, a monitor of scrolling code, a wall calendar and a corkboard of sticky notes](assets/preview.svg)

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install pixel-room@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

## The room

The room keeps to the left and right edges and the bottom of the window, so the middle, where the conversation sits, stays dark and calm.

- **The window**: a city behind the glass with a few lit windows and the day's weather outside. The window's light falls across the floorboards and changes with the weather.
- **Fairy lights**: a string draped along the top of the frame. While the lamp is lit each bulb glows softly, and while Claude works a slow chase runs along the string. By day they are unlit.
- **The bookcase**: low, under the window, with a candle and a small object for the season: a snow globe in winter, tulips in spring, a cactus in summer and a pumpkin in autumn.
- **The desk**: a desk lamp, a mug of tea with rising steam, a notebook and pencil, headphones hung on the monitor, and a monitor that shows what Claude is doing (below).
- **The wall**: a shelf with a trailing plant, a small calendar showing today's month and day, a round clock whose hands keep your local time, faint wallpaper, and a corkboard of sticky notes.
- **The floor**: a woven rug where the cat paces.

### Weather and the moon

Each day has its own weather, the same all day, picked from the date and the season: rain is the most common, then the season's own.

| Weather | At the window |
| --- | --- |
| Rain | Fast streaks outside and slow drops running down the glass, their shadows sliding through the light on the floor |
| Drizzle | Fine, faint streaks, beaded drops resting on the glass and a light mist over the far towers |
| Snow | Flakes falling slowly and swaying, snow on the near rooftops, a drift along the bottom of the glass and frost in its corners |
| Fog | The far towers gone, the near ones pale, a few soft lit windows and wide banks of fog drifting by |
| Clear | Stars from dusk to dawn; by day a pale cloud or two and a sunbeam reaching the floor, with dust drifting in it |

From dusk to dawn the moon crosses the upper glass in its real phase, low on the left in the evening, high around midnight and low on the right toward morning. Behind rain, drizzle or snow it is dimmer and haloed. It hides in fog and at new moon. On a clear night the floor takes its pale light.

`/pixel-room weather` says today's weather and the moon. `/pixel-room weather snow` (or `rain`, `drizzle`, `fog`, `clear`) pins one, here and in later sessions, and `/pixel-room weather auto` goes back to the day's own.

### The time of day and the seasons

| Time (your computer's clock) | The room |
| --- | --- |
| Dawn, 05:00 to 07:00 | An ember and rose sky with a low sun, the city's lit windows thinning out, the lamp still lit |
| Day, 07:00 to 17:00 | Daylight through the window, the lamp off, the room a little cooler |
| Dusk, 17:00 to 19:00 | A rose and amber sky, the lamp lit |
| Night, 19:00 to 05:00 | A dark city with lit windows, the lamp casting a warm pool over the desk and a glow on the wall |

From dusk on, the app's colours turn warmer, with text the colour of old paper. The seasons follow the local date, three months each, and turn around south of the equator, which the room tells from your time zone's name.

### What Claude is doing

| What happens | The room |
| --- | --- |
| Claude is idle | The monitor shows a dim, slow screensaver |
| A turn runs | The monitor scrolls code, and the fairy lights chase |
| The turn's first tool error | The monitor stops on a red line, the cat jumps and the lamp flickers once |
| A turn ends clean | The monitor shows a green check, then goes back to its screensaver a few minutes later |
| Claude writes a todo list or task list | Sticky notes on the corkboard: green when done, amber for the one under way, cream for the ones waiting, up to six with a `+` past that. With no list the board holds a polaroid, a postcard and a ticket stub |
| A subagent runs | A moth circles the lamp (the monitor by day), up to three |
| A `git push` goes through | A paper plane glides past the window |

## The cat

| When | The cat |
| --- | --- |
| Claude is idle | Asleep on a cushion on the sill, breathing slowly, with a few drifting z's and a twitch of the ear now and then |
| Claude starts a turn | Gets up and paces the rug in front of the desk |
| The turn's first tool call | Sits up facing the desk and watches, tail flicking, blinking now and then |
| The turn's first tool error | Jumps, ears back and tail on end, then settles back to watching |
| The turn ends clean | Stretches on the sill, then curls up to sleep |
| The turn ends with a failure, or you stop it | Curls straight up to sleep |
| You click the room, or run `/pixel-room pet` | Hearts rise over it and it purrs, at most once every three seconds |

The backdrop is redrawn only when the cat moves (at most four times a turn: its start, first tool call, first error and end), when the time of day or the date turns, when the monitor goes back to its screensaver, for a pet or a paper plane, and for a `/pixel-room` command. Changes to the notes and the moths wait a few seconds and share one redraw, so the backdrop is never redrawn on every tool call. Subagents' turns and tool calls don't move the cat.

## The rest of the window

- **Working line**: while Claude works, the line that usually shows a made-up word says something about the room instead, such as "The cat is pacing", "Rain on the glass", "Snow on the sill", "Moon over the city", "First light", "Moths at the lamp" or "Ticking off a note". One phrase is chosen per turn for each thing the turn does. In the desktop app only the plain "Working" is replaced, so the names of steps stay. A message the app shows there, such as compacting, is never changed.
- **Turn line**: in the terminal, the line that closes a turn uses the room's word, such as "Steeped for 12s", "Purred" or "Mulled", keeping the time. Expanded (ctrl+o), or while it waits for background agents, it is left as it is.
- **Footer**: one quiet label beside the app's own mode labels, following the weather and the light, such as `raining · lamp on`, `snowing · lamp on`, `clear · full moon` or `drizzle · dawn`.
- **Room card**: a pane with a framed portrait of the cat in its current pose, its window showing the day's weather and the moon, and a line on what the cat is doing ("asleep on the sill", "watching you work"). Below the portrait sit small instruments for the session:
  - a row of five mugs that fill as turns finish
  - a cassette whose tape winds from one reel to the other as turns go by, its reels turning while Claude works
  - a plant that perks up after a passing test run and droops after a failing one
  - a tiny corkboard of notes while a list runs

  `/pixel-room card` opens it; it never opens by itself. As a small widget in the desktop app it shows just the portrait, and expanded or docked the whole card. In the terminal it is two lines of text.
- **Sounds**: a soft rising chime when a turn ends clean, a soft low falling tone when its last tool call failed, its latest test run failed, or an API error ended it, and a quiet purr when you pet the cat. Nothing plays when you stop a turn.

A test run is a Bash or PowerShell command such as `npm test`, `pytest`, `cargo test` or `go test`.

## Commands

| Command | Does |
| --- | --- |
| `/pixel-room` | Describes the room in a few lines: the weather and the moon, the lamp, the cat, the notes and the moths, the cups and the plant, whether sounds are on, and whether this window draws the room |
| `/pixel-room pet` | Pets the cat: hearts and a purr, as a click on the room does |
| `/pixel-room weather` | Says today's weather and the moon |
| `/pixel-room weather rain\|drizzle\|snow\|fog\|clear` | Pins that weather, here and in later sessions |
| `/pixel-room weather auto` | Goes back to the day's own weather (`weather day` does the same) |
| `/pixel-room card` | Opens the room card |
| `/pixel-room card off` | Puts the card away |
| `/pixel-room card on` | Opens the card as a small widget |
| `/pixel-room mute` | Turns the sounds off, here and later |
| `/pixel-room unmute` | Brings the sounds back |
| `/pixel-room off` | Turns off the room, its card, working line, turn line, footer label and sounds, here and in later sessions |
| `/pixel-room on` | Brings the room back |
| `/pixel-room glass clear\|soft\|frosted` | How much veil sits over the room behind the chat: none, a light one (the default), or the full frost. Kept across sessions. |
| `/pixel-room forget` | Deletes its settings and turns it off for this session. Run it before removing the plugin |

To try it beside the other themes and switch between them, install the [`themes`](../themes) picker and run `/themes`.

## Where it shows

- The backdrop, the colours and the widget need the Claude desktop app's Code tab; the backdrop and the colours also show in the mobile app. Set the app's appearance to dark: the room and its colours are dark.
- Clicking the room to pet the cat needs Claude Code v2.1.326 or later, where the app passes a click on the backdrop to the room. Anywhere else, `/pixel-room pet` does the same.
- The working line, the footer label and the room card also show in the terminal, where the card is plain text, and the turn line shows only there. The terminal draws no backdrop.
- Sounds play on macOS, where Claude Code plays clips with `afplay`. A Linux or Windows terminal has no player, so there they play nothing.
- It needs Claude Code v2.1.324 or later.

## What it stores and reads

- It stores four settings in the plugin's own store on your machine: whether the room is off, whether sounds are muted, the glass, and a pinned weather. Settings an earlier version kept for the band and for the card opening by itself are deleted when a session starts. The cups, the tape, the plant's mood, the notes and the moths last for the session only.
- It reads whether each tool call errored, whether a Bash or PowerShell command looks like a test run, and whether a Bash command is a `git push`. It reads the statuses in Claude's todo list (TodoWrite) and task list (TaskCreate and TaskUpdate), only to count them, and when each Agent tool call starts and ends. It reads the local time for the time of day, the date, the season, the weather, the moon and the clock, and your time zone's name to tell north from south.
- It never reads file contents, the text of the todo list or tasks, your prompts or Claude's replies, and it sends nothing anywhere.

## Known limits

- The weather is the room's own, picked from the date and the season. It is not a forecast and knows nothing of the weather where you are.
- The seasons are told from your time zone's name. A zone south of the equator that the room doesn't know, or a machine set to UTC, gets the northern seasons.
- A subagent started in the background returns at once, so its moth may not show.
- A session has one theme. Another theme mod replaces this one, and setting this one replaces the other.
- `/pixel-room off` clears whichever theme stands, not only this one. `/pixel-room forget` clears it only while the room is on.
- With reduced motion turned on in your system, the room and the card are still: no rain, no snow, no pacing, no breathing, steady fairy lights, no hearts or plane, and the clock shows the time the room was last drawn.
- On a square window the window and the desk move toward the middle. On a tall phone screen the window moves up and the bookcase, the floor light, the clock, the plant shelf, the calendar and the corkboard are left out, so the window and the desk both fit.

## Develop

From the repository root:

```bash
claude plugin validate --strict plugins/pixel-room
claude plugin test plugins/pixel-room
claude --plugin-dir plugins/pixel-room     # try it, hot-reloads on save
```

- `hooks/model.ts` holds the shared vocabulary: what the scene and the card are drawn from.
- `hooks/sky.ts` works out the time of day, the season, the day's weather and the moon.
- `hooks/palette.ts` holds the 17 colours, `hooks/paint.ts` the shared dither patterns and `hooks/pixels.ts` turns pixel maps into compact SVG paths.
- `hooks/scene.ts` lays out the room from its parts: `hooks/shell.ts` (wall and floor), `hooks/window.ts` (the window wall and the weather), `hooks/desk.ts` (the desk wall) and `hooks/cat.ts` (the cat). `hooks/font.ts` is the small pixel font and `hooks/sprites.ts` holds the cat's frames.
- `hooks/card.ts` builds the card, with `hooks/vista.ts` drawing its tiny window.
- `hooks/room.ts` holds the turn's small decisions and the room's words.
- `hooks/look.ts` holds the app's colours.
- `hooks/register.tsx` wires the events, the command, the clock, the redraws and the theme.
- `types/index.d.ts` declares the state the card reads.

The preview above is the scene exactly as the plugin draws it on a rainy night while Claude works through a todo list with a subagent running. The sounds in `sounds/` are synthesized. After changing the scene or the sounds, make them again:

```bash
node --experimental-strip-types scripts/assets/pixel-room-preview.mts
node --experimental-strip-types scripts/assets/pixel-room-sounds.mts
```

See [CHANGELOG.md](CHANGELOG.md) for releases.
