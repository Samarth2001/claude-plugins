# claude-plugins

[![Validate](https://github.com/Samarth2001/claude-plugins/actions/workflows/validate.yml/badge.svg)](https://github.com/Samarth2001/claude-plugins/actions/workflows/validate.yml)

My Claude Code plugins, mods and skills in one place, published as a [plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) so any of them installs with two commands.

![buddy](plugins/buddy/assets/moods.svg)

## Install

Add the marketplace once:

```bash
claude plugin marketplace add Samarth2001/claude-plugins
```

Then install what you want, and run `/reload-plugins` in an open session (or start a new one):

```bash
claude plugin install buddy@samarth
```

Updates arrive when a plugin's version changes. To get them automatically, open `/plugin`, go to **Marketplaces**, select `samarth` and choose **Enable auto-update**. Otherwise:

```bash
claude plugin marketplace update samarth
claude plugin update buddy@samarth
```

In the Claude desktop app (Code tab, local sessions), installed plugins load too; manage them from **+** next to the prompt, then **Plugins**.

## Mods

Mods are plugins with function hooks that draw inside Claude Code. See [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/).

| Plugin | Version | What it does |
| --- | --- | --- |
| [`buddy`](plugins/buddy) | 0.3.0 | A pixel-art companion above the prompt that acts out what Claude is doing, with a sprout that wilts as context fills, a context sparkline, usage limits and cost |

## Skills

None yet.

## Layout

```
.claude-plugin/marketplace.json   the catalog: one entry per plugin
plugins/<name>/                   one plugin per mod or skill bundle
  .claude-plugin/plugin.json      its manifest (name, version, display fields)
  hooks/                          mod code (hooks.json, register.tsx) and *.test.tsx
  types/index.d.ts                the $.state contract of a mod
  skills/<skill>/SKILL.md         skills, run as /<plugin>:<skill>
  CHANGELOG.md                    one section per release
  README.md
scripts/                          repo tooling (asset generators)
.github/workflows/                validate + test on every push, GitHub release per tag
```

## Develop and release

See [CONTRIBUTING.md](CONTRIBUTING.md): adding a plugin, trying it with hot reload, and the release steps (bump `version`, changelog, `claude plugin tag --push`).

Mods run as code inside Claude Code with the same access it has. Read a plugin's source before installing it.

## License

[MIT](LICENSE)
