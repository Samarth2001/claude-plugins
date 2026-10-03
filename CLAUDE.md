# claude-plugins

A Claude Code plugin marketplace (`samarth`). Each plugin lives in `plugins/<name>/`. Read CONTRIBUTING.md before changing structure or releasing.

## Rules

- Keep the root README neutral. Never feature one plugin there. Its catalog table is generated: edit `.claude-plugin/marketplace.json`, then run `node --experimental-strip-types scripts/catalog.mts`.
- Keep each plugin self-contained, in Claude Code's standard layout, with its own README.md and CHANGELOG.md. Dev-only tooling goes in `scripts/`, never inside a plugin.
- Never rename a plugin's `name`. Leave `version` out of marketplace entries.
- Any change to a plugin's shipped files needs a version bump and a CHANGELOG section. README, CHANGELOG, `assets/` and tests are exempt.
- Before reporting work done, run `claude plugin validate --strict .`, `claude plugin validate --strict plugins/<name>`, `claude plugin test plugins/<name>` (if it has tests) and `node --experimental-strip-types scripts/catalog.mts --check`.
- Before writing a mod, load the `plugin-authoring` skill.
- Guides in `docs/` summarize the official docs at code.claude.com. Link to the source and don't state behavior you haven't checked.

## Commands

- New plugin: `node --experimental-strip-types scripts/new-plugin.mts <name> --with skill,agent,hooks,mcp,mod --description "..."`
- Regenerate assets: `node --experimental-strip-types scripts/assets/<script>.mts`
- Release: `/release <name>` (bump, changelog, tag)
