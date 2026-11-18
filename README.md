# claude-plugins

[![Validate](https://github.com/Samarth2001/claude-plugins/actions/workflows/validate.yml/badge.svg)](https://github.com/Samarth2001/claude-plugins/actions/workflows/validate.yml)

A collection of Claude Code extensions by Samarth Rayar: plugins, mods, skills, subagents, hooks and MCP servers, along with notes on building them well. The repo is a [plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces), so you can install each plugin on its own and keep it updated from Claude Code.

## Quick start

Add the marketplace once:

```bash
claude plugin marketplace add Samarth2001/claude-plugins
```

Browse it with `/plugin` in a session, or install a plugin by its id from the [catalog](#catalog):

```bash
claude plugin install <plugin>@samarth
```

Then run `/reload-plugins` in an open session, or start a new one. Inside a session, `/plugin marketplace add` and `/plugin install` do the same.

Plugins update when their version changes. To update automatically, open `/plugin`, go to **Marketplaces**, select `samarth` and choose **Enable auto-update**. To update by hand:

```bash
claude plugin marketplace update samarth
claude plugin update <plugin>@samarth
```

Installed plugins also load in the Claude desktop app (Code tab, local sessions). Manage them from **+** next to the prompt, then **Plugins**.

## Catalog

<!-- catalog:start -->
| Plugin | Install id | Type | What it does |
| --- | --- | --- | --- |
| [HUD](plugins/hud) | `hud` | mods | A live usage cockpit above the prompt: context, plan limits with pace forecasts, and cost by day, week and month, in a one-line glance that expands into tabs and a dashboard pane |
| [Constellation](plugins/constellation) | `constellation` | themes | A night sky behind the desktop app that maps your work: every file Claude touches becomes a star, and files edited together join into constellations that build up per project |
| [Real Sky](plugins/real-sky) | `real-sky` | themes | A quiet sky almanac behind the desktop app: the sun and moon ride an hour arc at your local time, the colors follow the light, and the weather and a barometer follow the session |
| [Pixel Room](plugins/pixel-room) | `pixel-room` | themes | A lo-fi pixel room behind the desktop app with the day's weather and the moon at the window, a cat you can pet that sleeps until Claude works, sticky notes for its todo list, moths for its subagents, a band above the prompt and soft sounds |
| [Themes](plugins/themes) | `themes` | mods | A theme picker above the prompt: thumbnails of every theme, tried live one click at a time, kept or put back, with each theme's options and an install or remove button |
<!-- catalog:end -->

Each plugin has its own README covering what it adds, how to use and configure it, and its changelog. This table is generated from [`marketplace.json`](.claude-plugin/marketplace.json) by `scripts/catalog.mts`.

## Guides

Notes on building Claude Code extensions, linked to the official docs:

- [Plugin anatomy](docs/plugin-anatomy.md): what each component is, where its files go, and how to pick one
- [Writing skills](docs/writing-skills.md): structure and habits for `SKILL.md` files that trigger reliably

## Repository layout

```
.claude-plugin/marketplace.json   the catalog: one entry per plugin
plugins/<name>/                   one self-contained plugin per folder
  .claude-plugin/plugin.json      its manifest: name, version, description
  skills/ agents/ hooks/ ...      its components, in Claude Code's standard layout
  README.md                       what it does and how to use it
  CHANGELOG.md                    one section per release
templates/                        starting files for new plugins
scripts/                          scaffolding, catalog and release checks, asset generators
docs/                             guides and best practices
.github/workflows/                validate and test on every push; a GitHub release per tag
```

## Contributing

To start a new plugin, run `node --experimental-strip-types scripts/new-plugin.mts <name> --with skill`. [CONTRIBUTING.md](CONTRIBUTING.md) covers the conventions, local testing and releases.

## Security

Plugins run inside Claude Code with your permissions. Hooks, mods and MCP servers execute code on your machine. Read a plugin's source before you install it.

## License

[MIT](LICENSE)
