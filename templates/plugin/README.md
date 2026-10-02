# {{displayName}}

{{description}}

## Install

```bash
claude plugin marketplace add Samarth2001/claude-plugins
claude plugin install {{name}}@samarth
```

Then run `/reload-plugins` in an open session, or start a new one.

## What it adds

{{components}}

## Usage

TODO: how to use it, with an example.

## Configuration

None.

## Develop

From the repository root:

```bash
claude plugin validate plugins/{{name}}
claude --plugin-dir plugins/{{name}}     # a session with it loaded
```

See [CHANGELOG.md](CHANGELOG.md) for releases.
