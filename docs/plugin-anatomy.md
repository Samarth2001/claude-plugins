# Plugin anatomy

A plugin is a folder that Claude Code loads components from. This page covers what each component does, where its files go, and the rules that keep a plugin loading for everyone who installs it. It summarizes the official [plugin manifest reference](https://code.claude.com/docs/en/plugins-reference) and [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference). When this page and those docs disagree, trust the docs.

## Pick a component

| You want Claude Code to | Use | Files |
| --- | --- | --- |
| Follow a procedure or know conventions when a task calls for it, or when you type `/plugin:skill` | Skill | `skills/<skill>/SKILL.md` |
| Hand a focused task to a separate context with its own prompt and tools | Subagent | `agents/<agent>.md` |
| Run a script at a fixed point, such as before a tool call, after an edit or at session start | Hooks | `hooks/hooks.json` |
| Draw in the interface, add commands or tools, or change behavior with code | Mod | `hooks/hooks.json` (`modules`) and a hooks module |
| Reach an external service or API as tools | MCP server | `.mcp.json` |
| Get code intelligence for a language | LSP server | `.lsp.json` |
| Change how Claude writes its answers | Output style | `output-styles/` |
| Give Claude a command-line tool to run as a bare command | Executable | `bin/` |

Skills replace the older `commands/` folder for new plugins. One plugin can mix components. A plugin that mixes several kinds goes in the `bundles` category.

## Standard layout

Only the manifest goes in `.claude-plugin/`. Everything else sits at the plugin root:

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json        manifest (name, version, description, ...)
├── skills/
│   └── <skill>/SKILL.md   one folder per skill, run as /my-plugin:<skill>
├── agents/
│   └── <agent>.md         subagents, named my-plugin:<agent>
├── hooks/
│   └── hooks.json         settings hooks under "hooks", and a mod's "modules"
├── output-styles/         output style Markdown files
├── bin/                   executables put on the Bash tool's PATH
├── scripts/               scripts your hooks call
├── settings.json          `agent` and `subagentStatusLine` defaults
├── .mcp.json              MCP servers
├── .lsp.json              LSP servers
├── README.md
└── CHANGELOG.md
```

Components in their default locations load without being listed in the manifest. List a path in `plugin.json` only to load something from somewhere else. For `commands`, `agents` and `outputStyles`, a manifest path replaces the default folder instead of adding to it.

## The manifest

`name` is the only required field, but every plugin here sets these:

```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "version": "0.1.0",
  "description": "One line on what it does",
  "author": { "name": "Samarth Rayar", "url": "https://github.com/Samarth2001" },
  "homepage": "https://github.com/Samarth2001/claude-plugins/tree/main/plugins/my-plugin",
  "repository": "https://github.com/Samarth2001/claude-plugins",
  "license": "MIT",
  "keywords": []
}
```

- **`name`** is the install id and the namespace for every component, so never change it after release. Use kebab-case. Names that start with `claude-`, `anthropic-` or `cc-plugin-` are reserved.
- **`version`** pins users to that version until it changes. A change that doesn't bump it never reaches anyone who already installed the plugin.
- **`userConfig`** declares values Claude Code asks the user for, such as an API endpoint or a token. Mark secrets `"sensitive": true` so they go to secure storage instead of `settings.json`.
- **`dependencies`** lists other plugins that must be enabled for this one to work.

## Paths and variables

- Every path in the manifest is relative to the plugin root and starts with `./`. A path can't leave the plugin folder.
- **`${CLAUDE_PLUGIN_ROOT}`** is the installed plugin's folder. Use it for bundled scripts and config. It changes on every update, so don't write state there.
- **`${CLAUDE_PLUGIN_DATA}`** is a per-plugin folder that survives updates. Use it for caches, generated files and installed dependencies.
- **`${CLAUDE_PROJECT_DIR}`** is the project root.
- In shell-form hook commands, quote the variable so a path with spaces stays one word: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/check.sh"`.

## Rules of thumb

- **Run `claude plugin validate` on every change.** It is the authoritative check for manifests, hooks files, MCP entries and mod modules. Add `--strict` to fail on warnings.
- **Keep a plugin self-contained.** Users get a copy of the plugin folder, so it can't reach files outside it.
- **Don't put a `CLAUDE.md` in a plugin.** It isn't loaded. Put instructions in a skill.
- **Think twice about `bin/`.** claude.ai and Cowork don't install a plugin that has a top-level `bin/` folder.
- **Say what a plugin runs.** Hooks, mods and MCP servers execute code with the user's permissions. Each plugin's README should say what runs and when.
- **For mods, test the code and say which Claude Code version you tested with.** `claude plugin test` runs `*.test.ts` files without a session. The mods API can change between releases.

## Further reading

- [Create a plugin](https://code.claude.com/docs/en/plugins/create)
- [Plugin components](https://code.claude.com/docs/en/plugins/components)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Mods: create](https://code.claude.com/docs/en/plugins/mods/create), [test](https://code.claude.com/docs/en/plugins/mods/test) and [reference](https://code.claude.com/docs/en/plugins/mods/reference)
- [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace)
