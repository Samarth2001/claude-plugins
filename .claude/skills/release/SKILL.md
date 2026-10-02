---
name: release
description: Release a new version of a plugin in this marketplace.
disable-model-invocation: true
argument-hint: "<plugin> [patch|minor|major]"
---

Release plugin: $ARGUMENTS

1. Read `plugins/<name>/CHANGELOG.md` and run `git log <name>--v<current-version>..HEAD -- plugins/<name>`. If that tag doesn't exist, use the full log for the folder. Then list what changed.
2. Choose the bump if none was given: patch for fixes, minor for features, major for breaking changes such as renamed commands or settings. Confirm it with me.
3. Set `version` in `plugins/<name>/.claude-plugin/plugin.json`. Add a `## [<version>] - <today>` section to the CHANGELOG under Added, Changed or Fixed, plus its compare link at the bottom.
4. Run `claude plugin validate .`, `claude plugin validate plugins/<name>`, `claude plugin test plugins/<name>` if it has tests, and `node --experimental-strip-types scripts/catalog.mts --check`.
5. Commit as `<name>: release <version>`. Then stop and show me the commands to push and tag: `git push` and `claude plugin tag plugins/<name> --push`.
