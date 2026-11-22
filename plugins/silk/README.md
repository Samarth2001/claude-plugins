# Silk

Graphite satin behind the conversation in the Claude desktop app, folding slowly in a draft. One broad, soft sheen moves over its long diagonal folds, lit from the upper left, and your pointer gently steers the light. While Claude works the folds drift a little faster, each tool call sends a long, low wave through the cloth, and a finished turn draws one slow band of light across it. The app's own colours are graphite grays with a faint cool tint, taken from the same cloth.

![Dark graphite satin in long, soft folds, sweeping in an arc from the lower left up across the top](assets/preview.svg)

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install silk@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

## How it moves

| What happens | The backdrop |
| --- | --- |
| Claude is working | The folds drift faster and the sheen brightens slightly |
| A tool call | A long, low wave passes through the cloth from the prompt |
| A tool error | The sheen warms toward rose for a moment |
| A turn ends | One slow band of light crosses the folds |
| You move the pointer | The light follows it, softly |
| The prompt box | A faint warm light rests behind it |
| The hour (your computer's clock) | Cool graphite by day; from evening to early morning the cloth takes a violet cast |

Only the main conversation moves it: subagents' turns and tool calls leave it alone.

## Use it

| Command | Does |
| --- | --- |
| `/silk` | Says whether it is on, whether this window draws it, and the glass |
| `/silk off` | Turns it off, here and in later sessions |
| `/silk on` | Brings it back, and keeps it on |
| `/silk glass clear\|soft\|frosted` | How much veil sits over the cloth behind the chat: none, a light one (the default), or the full frost. Kept across sessions |
| `/silk forget` | Deletes its settings and turns it off for this session. Run it before removing the plugin |

One theme shows at a time. Installed beside another theme and never turned on by name, Silk leaves the other one showing; `/silk on` puts it in place and keeps that choice for later sessions. `off` and `forget` clear the session's theme only while it is Silk's, so they never take another theme down.

The themes picker, `/themes` from the [`themes`](../themes) plugin, shows it beside the other themes with a Glass option.

## Where it shows

- The desktop app's Code tab draws it live, on the GPU, on Claude Code 2.1.326 or later.
- The mobile app, the desktop app under Reduce Motion, and earlier builds show the still picture above, by day or with its night cast.
- The terminal and editors draw no backdrop.
- It runs at 30 fps, and on a weak GPU it eases to a reduced sharpness: `claude plugin validate` reports `sharpness 1.14 weak, 2.00 fast, at 30 fps`. Where it still runs too slowly, the app shows the still picture.
- It stores two settings in the plugin's own store: whether you turned it on or off, and the glass. It reads the local time, and whether each of the main conversation's tool calls errored. It sends nothing anywhere.

## Develop

From the repository root:

```bash
claude plugin validate --strict plugins/silk
claude plugin test plugins/silk
claude --plugin-dir plugins/silk     # try it, hot-reloads on save
node --experimental-strip-types scripts/assets/silk-preview.mts     # redraw assets/preview.svg
```

See [CHANGELOG.md](CHANGELOG.md) for releases.
