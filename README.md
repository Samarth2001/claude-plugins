# claude-plugins

My Claude Code plugins, mods and skills in one place, published as a [plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) so any of them installs with two commands.

## Install

Add the marketplace once:

```bash
claude plugin marketplace add Samarth2001/claude-plugins
```

Then install what you want, and run `/reload-plugins` in an open session (or start a new one):

```bash
claude plugin install buddy@samarth
```

To get updates automatically, open `/plugin`, go to **Marketplaces**, select `samarth` and choose **Enable auto-update**. Otherwise update by hand:

```bash
claude plugin marketplace update samarth
```

In the Claude desktop app (Code tab, local sessions), installed plugins load too. You can also manage them from **+** next to the prompt, then **Plugins**.

## Mods

Mods are plugins with function hooks that draw inside Claude Code. See [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/).

| Plugin | What it does |
| --- | --- |
| [`buddy`](plugins/buddy) | A quiet companion above the prompt that acts out what Claude is doing (thinking, reading, editing, running, browsing, delegating), beside context, usage limits and cost |

## Skills

None yet.

## Layout

```
.claude-plugin/marketplace.json   the catalog: one entry per plugin
plugins/<name>/                   one plugin per mod or skill bundle
  .claude-plugin/plugin.json      its manifest
  hooks/                          mod code (hooks.json + register.tsx) and tests
  skills/<skill>/SKILL.md         skills, run as /<plugin>:<skill>
```

## Develop

```bash
claude plugin validate .                    # the marketplace
claude plugin validate plugins/<name>       # one plugin
claude plugin test plugins/<name>           # its tests
claude --plugin-dir plugins/<name>          # try it in a session
```

Bump `version` in a plugin's `plugin.json` when releasing a change; installs only update when the version changes.

Mods run as code inside Claude Code with the same access it has. Read a plugin's source before installing it.

## License

[MIT](LICENSE)
