# buddy

An animated companion that lives above the Claude Code prompt and acts out what Claude is doing, next to the numbers that matter for the session.

## What it shows

| Item | Source |
| --- | --- |
| Companion mood: ready, thinking, reading, editing, running a command, browsing, delegating to a subagent, using another tool, done, error, sleeping when idle for 2 minutes, full at 90% context | `prompt.submit`, `tool.call`, `turn.complete` hooks |
| What it is working on, like `editing register.tsx · 12s` | the running tool's input |
| Context window: bar, percent, tokens used of the window, tokens the last turn added | `$.session.usage()`, `session.measure` |
| 5-hour and 7-day usage limits with time until reset | same |
| Session cost in USD | same |
| Tools called this turn, files edited this session, model | `tool.call`, `$.session.model()` |

The companion's color follows the context window: blue under 50%, amber from 50%, pink from 75% (it starts to sweat), red from 90%.

On the desktop app and VS Code it is an animated SVG. In the terminal it is an animated text face. `Hide` turns it off for the session.

## Develop

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
