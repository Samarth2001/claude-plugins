# buddy

A quiet companion that lives above the Claude Code prompt and acts out what Claude is doing, next to the numbers that matter for the session.

```
◦‿◦ ⌕  reading register.tsx · 4s                    ctx 38% · 5h 22% · $0.41  hide
```

## Moods

It stays grey and still. Only the eyes and one small prop change:

| Mood | Terminal | When |
| --- | --- | --- |
| ready | `◦‿◦` (blinks now and then) | waiting for you |
| thinking | `◦‿◦ ···` | a turn is running, no tool yet |
| reading | `◦‿◦ ⌕` | Read, Grep, Glob |
| editing | `◦‿◦ ✎` | Edit, Write, NotebookEdit |
| running | `◦‿◦ ›››` | Bash |
| browsing | `◦‿◦ ◜` | WebFetch, WebSearch |
| delegating | `◦‿◦ ⇢` | a subagent |
| working | `◦‿◦ ◴` | any other tool, MCP tools included |
| done | `◠‿◠ ✧` | for 3 seconds after a turn |
| that failed | `◦⌒◦ !` | for 2 seconds after a tool error |
| full | `◦⌒◦ !` | context at 90% or more, with a hint to `/compact` |
| idle | `‒‿‒ ᶻ` | nothing for 2 minutes |

On the desktop app and VS Code it is a small animated pebble (SVG) with the same moods: it breathes, blinks and carries one hairline prop.

Color only means a warning: the companion turns amber from 75% context and red from 90% or on an error. Numbers stay dim until they pass 75%.

## What it shows

| Item | When |
| --- | --- |
| What it is working on, like `editing register.tsx · 12s` | always |
| Context window percent | always |
| 5-hour limit | always |
| Session cost in USD | always |
| 7-day and other limits, with time until reset | when wide (140+ columns), or always once past 75% |
| Tokens used of the window, tools this turn, files edited, model | when wide |

Data comes from `$.session.usage()`, `session.measure`, `prompt.submit`, `tool.call`, `turn.complete` and `$.session.model()`. `hide` turns it off for the session.

## Develop

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
