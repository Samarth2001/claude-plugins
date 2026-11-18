# Themes

A theme picker above the prompt. `/themes` opens a strip of small previews, one per theme. Pick one and it goes on at once, so you can step through them; Keep keeps the one you like, and Cancel puts back what was on. Each theme's own options sit under the strip, and themes you don't have yet install from the same place.

It lists Samarth's [Pixel Room](../pixel-room) and the twenty scenes of Anthropic's `theme-examples` plugin, each tagged with who built it.

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install themes@samarth
```

Then run `/reload-plugins` in an open session, or start a new one, and run `/themes`. Until one of Samarth's themes is installed, the band offers **Install all by Samarth**, which installs every one of them at once. To install everything from a shell instead:

```bash
claude plugin install themes@samarth && claude plugin install pixel-room@samarth
```

Every theme stays its own plugin. `themes` doesn't list them as dependencies: Claude Code installs a missing dependency again on `/reload-plugins`, so a theme you removed would keep coming back.

## The band

`/themes` opens a band above the prompt. It never opens unasked.

- **The strip.** One tile per theme with its title and a faint "by Samarth" or "by Anthropic". In the desktop and mobile apps each tile has a small picture; in the terminal it is one line of text with a coloured mark. ✓ marks the theme that is on. When the tiles don't fit the width, ‹ and › page through them.
- **Pick a tile** to try the theme live. The theme that was on goes off first, so two themes never run at once.
- **Options** for the picked theme sit under the strip and run that theme's own command as soon as you change them. Pixel Room: the glass, the card and the sound. Anthropic's scenes: whether Keep applies the scene to this project or this session only.
- **Keep** keeps the picked theme and closes the band. **Cancel** puts back the theme that was on when you opened it and closes the band. Esc returns the keys to the prompt but leaves the band open.
- **Install** appears on a theme you don't have, **Remove** on one you do, after a yes. Anthropic's scenes show as one tile until their plugin is installed.

The band steps aside while a survey holds that space, keeps to the rows it is given, and shows its strip and the picked theme's line first when rows are short.

## Commands

| Command | Does |
| --- | --- |
| `/themes` | Opens the band |
| `/themes <name>` | Switches to that theme and keeps it, by id or title (`/themes pixel-room`, `/themes Night Reef`) |
| `/themes list` | Lists every theme with its author and whether it is installed or on |
| `/themes off` | Turns the theme off |

## What each action runs

The picker draws no theme itself. It runs each theme's own slash command, the same words you could type. Their replies are kept out of the transcript; an option's or an action's reply shows in the band instead.

| Action | Runs |
| --- | --- |
| Try or keep one of Samarth's themes | `/<theme> off` for the theme that was on, then `/<theme> on` |
| Try an Anthropic scene | `/<theme> off` for the theme that was on, then `/custom-theme <scene> session` |
| Keep an Anthropic scene | `/custom-theme <scene>` for this project, or `/custom-theme <scene> session` |
| Change an option | The theme's command with that word: `/pixel-room glass clear`, `/pixel-room card off`, `/pixel-room mute` |
| Install | `claude plugin install <plugin>@<marketplace>` on your machine |
| Remove | `/<theme> off` if it is on, then `/<theme> forget` for Samarth's themes, then `claude plugin uninstall <plugin>@<marketplace>` |

After an install or a removal, run `/reload-plugins` to finish. If the band can't run `claude` on your machine (it isn't on the PATH Claude Code sees), it shows the exact command to run in a shell instead.

When a session starts with a theme kept, only that theme draws. Another installed theme that tries to set itself is held back quietly, with no command run and nothing in the transcript, until you turn it on from the picker or by typing its command (`/pixel-room on`). With no theme kept, nothing is held.

## What it stores

- The theme you kept and the options you chose from the band, in this plugin's own store on your machine. It reads which commands the session lists, to know which themes are installed, and which plugin set the session's theme.
- It sends nothing anywhere. Install and Remove run `claude plugin` on your machine.

## What stays after a removal

- **Samarth's themes:** `forget` deletes everything the theme stored, so nothing of its own is left. Claude Code's record of the install goes with `claude plugin uninstall`.
- **Anthropic's `theme-examples`:** it has no forget command, so the picker turns its theme off (`/custom-theme off`, which also clears this project's choice) before uninstalling it. The choices it stored for other projects and sessions stay in its store.
- **This plugin:** its own store keeps the theme you kept and your options. Removing `themes` leaves the themes installed.

## Add a theme to the picker

Add one entry to `CATALOG` in [`hooks/catalog.ts`](hooks/catalog.ts): its id, title, author, plugin, marketplace, command, the words that turn it on and off (and `forget`, if it has one), its options, and a thumbnail (`art` drawn in [`hooks/thumbs.ts`](hooks/thumbs.ts), or a `swatch` from one colour). Each option is a `choice` (a Select whose values each name the words to run) or an `action` (a Button, with an optional `confirm` question). The picker needs nothing else from the theme: it must only have a slash command with an on and an off.

A theme that follows this repo's convention also takes `glass clear|soft|frosted`; give it the shared `GLASS` option so the picker shows it. An option typed as a command (`/pixel-room glass clear`) shows in the band as set.

## Known limits

- The desktop app draws its own solid backing behind the band, the full width of the window, while the band is open. A plugin can't change it; Keep or Cancel closes the band and it goes.

- One theme shows at a time, and a theme's `off` clears whichever theme stands, so the picker always turns the old theme off before the new one on.
- A theme that set itself before this plugin loaded (a hot reload of the picker mid-session) isn't held back until the next start, or until you pick another.
- A held theme still counts itself on in its own settings; it is only held while this plugin is installed and a theme is kept. Uninstall the picker and every installed theme that is on draws again at the next start.
- Anthropic's scene list is written into the catalog from `theme-examples` 0.4.3. A scene it adds later shows up once it is added to the catalog, and one it renames stops switching until the catalog follows.
- Pictures on the tiles are the picker's own small drawings, not the themes' live scenes. Anthropic's scenes show as a colour swatch of their glass tint with two letters of the name.
- Claude Code runs a command a plugin asks for once the session is idle, so a pick made during a turn takes effect when the turn ends.

## Develop

From the repository root:

```bash
claude plugin validate --strict plugins/themes
claude plugin test plugins/themes
claude --plugin-dir plugins/themes --plugin-dir plugins/pixel-room
```

`hooks/catalog.ts` is the registry, `hooks/plan.ts` works out which commands to run, `hooks/thumbs.ts` draws the tiles' pictures, `hooks/band.tsx` draws the band, and `hooks/register.tsx` holds the events, the command and the actions. `types/index.d.ts` declares what the band reads from `$.state`. Tested with Claude Code 2.1.325.

See [CHANGELOG.md](CHANGELOG.md) for releases.
