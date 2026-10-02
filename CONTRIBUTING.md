# Working on this repo

Every plugin lives in `plugins/<name>/` and has an entry in `.claude-plugin/marketplace.json`. The README catalog is generated from those entries. On each push and pull request, CI validates the marketplace and every plugin, runs the tests, and checks that the catalog, generated assets and versions are up to date.

## Conventions

- **One plugin per folder, self-contained.** Everything a plugin needs lives under `plugins/<name>/`. Installed plugins are copied into a cache, so a plugin can't reach files outside its folder. Refer to bundled files with `${CLAUDE_PLUGIN_ROOT}`. Keep state that must survive updates in `${CLAUDE_PLUGIN_DATA}`.
- **Standard layout.** Put components in Claude Code's default locations (`skills/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, and so on) rather than custom paths. Only `plugin.json` goes in `.claude-plugin/`. See [docs/plugin-anatomy.md](docs/plugin-anatomy.md).
- **Every plugin has a README and a CHANGELOG.** The README covers what it adds, how to use it, its configuration and how to develop it. The root README stays neutral: one generated catalog row per plugin, nothing more.
- **Names.** Use kebab-case and keep `name` the same in the folder, `plugin.json` and the marketplace entry. Names that start with `claude-` or `anthropic-` are reserved.
- **Marketplace entries** carry `name`, `source`, `description`, `category` and `tags`. Leave `version` out: `plugin.json` holds it. Suggested categories: `mods`, `skills`, `agents`, `hooks`, `mcp`, `output-styles`, `themes`, `bundles` (several kinds at once).
- **No `CLAUDE.md` inside a plugin.** Claude Code doesn't load it from a plugin. Put instructions for Claude in a skill.
- **Dev-only files stay outside plugins.** Asset generators and other tooling go in `scripts/`, because everything under `plugins/<name>/` ships to users.

## Add a plugin

Scaffold it:

```bash
node --experimental-strip-types scripts/new-plugin.mts <name> --with skill --description "One line on what it does"
```

`--with` takes a comma-separated list of `skill`, `agent`, `hooks`, `mcp` and `mod`. The script creates `plugins/<name>/` from [`templates/`](templates) with a manifest, a README, a CHANGELOG and the chosen components. It also adds the marketplace entry and regenerates the README catalog. Then fill in the TODOs.

- **Skills** live in `skills/<skill>/SKILL.md` and run as `/<plugin>:<skill>`. See [docs/writing-skills.md](docs/writing-skills.md).
- **Subagents** live in `agents/<agent>.md`.
- **Hooks** go in `hooks/hooks.json` under `"hooks"`, in the same shape as `settings.json` hooks. Reference scripts as `"${CLAUDE_PLUGIN_ROOT}"/scripts/...`.
- **MCP servers** go in `.mcp.json`.
- **A mod** puts `"modules": ["./register.ts"]` in `hooks/hooks.json`, with the hooks module and `*.test.ts` files beside it. If it keeps values in `$.state`, also add `types/index.d.ts` and `"types": "./types/index.d.ts"` to the manifest. In a Claude Code session, load the `plugin-authoring` skill before you write one.

If you edit the marketplace by hand, run `node --experimental-strip-types scripts/catalog.mts` to regenerate the catalog and check that everything agrees.

## Try it

```bash
claude plugin validate .                     # the marketplace
claude plugin validate plugins/<name>        # the plugin
claude plugin test plugins/<name>            # its tests (mods)
claude --plugin-dir plugins/<name>           # a session with it loaded; mods hot-reload on save
```

`claude --debug` shows why a hook was skipped or a drawing refused. When Claude Code loads a mod from disk, it writes the mod's types to `plugins/<name>/.claude-plugin/types/` (gitignored). The mod's `tsconfig.json` extends them, so an editor or `npx tsc -p plugins/<name>` can type-check it.

## Generated assets

A script in `scripts/assets/` that renders a file into a plugin, such as a README image, must accept `--check`. With that flag it exits non-zero when the committed file is stale, and CI runs every such script that way. After changing what an asset is drawn from, run:

```bash
node --experimental-strip-types scripts/assets/<script>.mts
```

## Release

Users only get a change when the plugin's `version` changes. CI fails when a plugin's shipped files change without a version bump. Docs, `assets/` and tests don't count as shipped files.

1. Bump `version` in `plugins/<name>/.claude-plugin/plugin.json` ([semver](https://semver.org/)): a patch for fixes, a minor for features, a major for breaking changes such as renamed commands or settings.
2. Move the changes into a new `## [<version>] - <date>` section of `plugins/<name>/CHANGELOG.md`.
3. Validate and test, then commit and push to `main`.
4. Tag the release and push the tag:

   ```bash
   claude plugin tag plugins/<name> --push
   ```

   This creates `<name>--v<version>`. Before tagging, it checks that `plugin.json` and the marketplace entry agree and that the tree is clean. Dependency version ranges resolve against this tag convention. Pushing the tag runs the Release workflow, which publishes a GitHub release with that version's changelog section.

5. Update your own install:

   ```bash
   claude plugin marketplace update samarth
   claude plugin update <name>@samarth
   ```

## Rename or remove a plugin

Never change a plugin's `name`, because it is the install id. Change `displayName` instead. If a rename or removal can't be avoided, record it in the `renames` map of `marketplace.json` (`"old": "new"` or `"old": null`). That map is append-only history.

## Commits

Commit as `Samarth Rayar <samarthsr2001@gmail.com>`. Make one change per commit. Start the subject with the plugin name for plugin changes (`buddy: ...`) and describe the area for repo-wide changes (`Release workflow: ...`).
