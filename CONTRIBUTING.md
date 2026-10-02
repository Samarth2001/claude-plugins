# Working on this repo

Every plugin lives in `plugins/<name>/`, has an entry in `.claude-plugin/marketplace.json` and a row in the README table. CI validates and tests every plugin on each push and pull request.

## Add a plugin

1. Create `plugins/<name>/` with at least `.claude-plugin/plugin.json`:

   ```json
   {
     "name": "<name>",
     "displayName": "<Name>",
     "version": "0.1.0",
     "description": "<one line>",
     "author": { "name": "Samarth Rayar", "url": "https://github.com/Samarth2001" },
     "homepage": "https://github.com/Samarth2001/claude-plugins/tree/main/plugins/<name>",
     "repository": "https://github.com/Samarth2001/claude-plugins",
     "license": "MIT",
     "keywords": []
   }
   ```

   - **A mod** adds `hooks/hooks.json` (`{ "modules": ["./register.tsx"] }`), `hooks/register.tsx` and `hooks/*.test.tsx`. If it keeps values in `$.state`, add `types/index.d.ts` and `"types": "./types/index.d.ts"` to the manifest. In a Claude Code session, load the `plugin-authoring` skill before writing one.
   - **Skills** go in `skills/<skill>/SKILL.md`.

2. Add `README.md` and a `CHANGELOG.md` with a `0.1.0` section.
3. Add the entry to `.claude-plugin/marketplace.json` (`name`, `source: "./plugins/<name>"`, `description`, `category`, `tags`). Keep `version` out of the entry: `plugin.json` holds it.
4. Add a row to the table in the root `README.md`.

## Try it

```bash
claude plugin validate .                     # the marketplace
claude plugin validate plugins/<name>        # the plugin
claude plugin test plugins/<name>            # its tests
claude --plugin-dir plugins/<name>           # a session with it loaded; saving reloads it
```

`claude --debug` shows why a hook was skipped or a drawing refused. Loading a plugin from disk writes its types to `plugins/<name>/.claude-plugin/types/` (gitignored), which the plugin's `tsconfig.json` extends, so an editor or `npx tsc -p plugins/<name>` type-checks it.

## Release

Users only receive a change when the plugin's `version` changes.

1. Bump `version` in `plugins/<name>/.claude-plugin/plugin.json` ([semver](https://semver.org/): patch for fixes, minor for features, major for breaking changes such as renamed commands or settings).
2. Move the changes into a new section of `plugins/<name>/CHANGELOG.md` and update the version in the README table.
3. Validate and test, then commit and push to `main`.
4. Tag the release and push the tag:

   ```bash
   claude plugin tag plugins/<name> --push
   ```

   This creates `<name>--v<version>`, after checking that `plugin.json` and the marketplace entry agree and that the tree is clean. The tag convention is what dependency version ranges resolve against. Pushing it runs the Release workflow, which publishes a GitHub release with that version's changelog section.

5. Update your own install:

   ```bash
   claude plugin marketplace update samarth
   claude plugin update <name>@samarth
   ```

## Rename or remove a plugin

Never change a plugin's `name`: it is the install id. Change `displayName` instead. If a rename or removal is unavoidable, record it in the `renames` map of `marketplace.json` (`"old": "new"` or `"old": null`), which is append-only history.

## Commits

Commit as `Samarth Rayar <samarthsr2001@gmail.com>`. One change per commit, with the plugin name first in the subject (`buddy: ...`).
