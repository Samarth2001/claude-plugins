# Writing skills

A skill is a `SKILL.md` file that Claude loads when a task matches its description, or when you type its command. In a plugin, `skills/<skill>/SKILL.md` runs as `/<plugin>:<skill>`. This page summarizes the official [skills docs](https://code.claude.com/docs/en/skills).

## Shape

```markdown
---
name: review-pr
description: Review a pull request for correctness and style. Use when asked to review a PR, a diff or a branch.
---

1. Read the diff with `git diff main...HEAD`.
2. ...
```

The frontmatter starts on the first line. If it doesn't parse, the whole file is treated as the skill body.

## Frontmatter worth knowing

| Field | Use it to |
| --- | --- |
| `description` | Say what the skill does and when to use it. Claude picks skills by this text, so include the words a user would actually say |
| `disable-model-invocation: true` | Run the skill only when you type it, for anything with side effects such as a release or a deploy |
| `user-invocable: false` | Hide it from the `/` menu when it's background knowledge for Claude only |
| `allowed-tools` | Pre-approve tools for the turn the skill runs in, such as `Bash(git *)` |
| `argument-hint`, `arguments` | Take arguments, used as `$ARGUMENTS`, `$0` or named `$name` |
| `context: fork` with `agent` | Run in a separate subagent context that doesn't see the conversation |
| `paths` | Limit when the skill applies, such as `"*.py"` |

## Habits

- **Keep `SKILL.md` under 500 lines.** Every line is loaded each time the skill runs. Move long reference material into files beside it and link them from `SKILL.md`, so Claude reads them only when needed.
- **State what to do, not why.** Use short numbered steps for procedures and bullet rules for conventions.
- **Put scripts in the skill folder** and reference them with `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PLUGIN_ROOT}`, so they work wherever the plugin is installed.
- **Inject live context with `` !`command` ``** when the skill needs fresh facts, such as the current diff. The output replaces the placeholder before Claude reads the skill.
- **Test the trigger.** Ask for the task in plain words without naming the skill, and check that Claude picks it up. If it doesn't, rewrite the description.

## Layout

```text
skills/review-pr/
├── SKILL.md          overview and steps
├── reference.md      details, read on demand
└── scripts/
    └── collect.sh    run, not read
```
