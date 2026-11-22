# Pearl

A muted, pearly sheen behind the conversation in the Claude desktop app, like the inside of a shell: faint greens, lilacs and rose blended with grey, drifting in soft patches over near-black and leaving the middle calm. It is drawn on the GPU and moves with Claude. The sheen deepens while Claude works, faint rings of it spread from the prompt as tools run, it turns a muted copper at an error, and your pointer turns it into a slow swirl. The app's own colours are cool grays with a trace of lilac, taken from the same numbers as the sheen.

![Soft, faint patches of pearly green, lilac, rose and blue blending over a near-black ground.](assets/preview.svg)

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install pearl@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

## How it moves

| What happens | The backdrop |
| --- | --- |
| Claude is working | The sheen deepens and drifts a little faster |
| A tool call | A faint ring of sheen spreads from the prompt |
| A tool error | The sheen turns a muted copper, then fades back |
| A turn ends | A slow, wide ring of sheen moves outward |
| You send a message | One wide, faint ring of sheen leaves the prompt (a message you type: a continuation sends none) |
| Your pointer moves over it | It turns the sheen into a slow swirl |
| The prompt box | The rings start from it, wherever it sits |
| The hour | From dusk the ground darkens toward night, and lightens again after dawn |

Subagents' turns and tool calls leave it alone.

## Use it

- `/pearl` says whether it is on, whether this window draws it, and the glass.
- `/pearl off` turns it off, here and in later sessions.
- `/pearl on` brings it back, and keeps it on.
- `/pearl glass clear|soft|frosted` sets how much veil sits over the sheen behind the chat: none, a light one (the default), or the full frost. It is kept across sessions.
- `/pearl forget` deletes its settings and turns it off for this session. Run it before removing the plugin.

One theme shows at a time. Installed beside another theme and never turned on by name, Pearl leaves the other one showing; `/pearl on` puts it in place and keeps that choice for later sessions. `off` and `forget` clear the session's theme only while it is Pearl's, so they never take another theme down.

The [`themes`](../themes) picker (`/themes`) shows it beside the other themes, with a Glass option.

## Where it shows

- The desktop app draws it live on Claude Code 2.1.326 or later. Set the app's appearance to dark: the sheen and its colours are dark.
- The mobile app, Reduce Motion and earlier builds show the still picture above.
- The terminal and editors draw no backdrop.
- The shader runs at 30 fps and eases to a reduced sharpness on a weak GPU. `claude plugin validate` reports `sharpness 0.86 weak, 2.00 fast, at 30 fps`.

## Develop

From the repository root:

```bash
claude plugin validate --strict plugins/pearl
claude plugin test plugins/pearl
claude --plugin-dir plugins/pearl     # try it, hot-reloads on save
```

- `hooks/shader.ts` is the sheen, in the shader language of `claude-code/shader`.
- `hooks/still.ts` draws the still picture.
- `hooks/look.ts` holds the app's colours and the glass.
- `hooks/register.tsx` wires the events, the command, the clock and the theme.

The preview above is the still picture by day. After changing it, make it again:

```bash
node --experimental-strip-types scripts/assets/pearl-preview.mts
```

See [CHANGELOG.md](CHANGELOG.md) for releases.
