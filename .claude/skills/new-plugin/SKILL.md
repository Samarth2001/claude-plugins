---
name: new-plugin
description: Scaffold a new plugin in this marketplace. Use when asked to add, create or start a new plugin, skill bundle, mod, subagent, hook or MCP server in this repo.
argument-hint: "<name> [what it should do]"
---

Create a new plugin from: $ARGUMENTS

1. Pick a kebab-case name and the components it needs (`skill`, `agent`, `hooks`, `mcp`, `mod`). Read `docs/plugin-anatomy.md` to choose. If the name or purpose is unclear, ask.
2. Run `node --experimental-strip-types scripts/new-plugin.mts <name> --with <components> --description "<one line>"`.
3. Fill in every TODO in `plugins/<name>/`. For a skill, follow `docs/writing-skills.md`. For a mod, load the `plugin-authoring` skill first.
4. Write the plugin README: what it adds, usage with an example, configuration, and what code it runs.
5. Run `claude plugin validate plugins/<name>`, `claude plugin test plugins/<name>` for a mod, `claude plugin validate .` and `node --experimental-strip-types scripts/catalog.mts --check`. Fix anything they report.
