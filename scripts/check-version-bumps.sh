#!/usr/bin/env bash
# Fails when a plugin's shipped files changed between two commits but its
# plugin.json version did not: users would never receive the change.
#
#   scripts/check-version-bumps.sh <base-ref> [head-ref]
#
# Docs, assets and tests don't count as shipped changes.
set -euo pipefail

base="${1:?usage: check-version-bumps.sh <base-ref> [head-ref]}"
head="${2:-HEAD}"

version_at() {
  git show "$1:$2" 2>/dev/null | sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1
}

status=0
for dir in $(git diff --name-only "$base" "$head" -- plugins | cut -d/ -f1-2 | sort -u); do
  name="${dir#plugins/}"
  manifest="$dir/.claude-plugin/plugin.json"
  [ -n "$(git ls-tree "$head" -- "$manifest")" ] || continue # removed plugin

  shipped=$(git diff --name-only "$base" "$head" -- "$dir" |
    grep -vE '\.md$|/assets/|\.test\.(ts|tsx)$' || true)
  [ -n "$shipped" ] || continue

  before=$(version_at "$base" "$manifest")
  after=$(version_at "$head" "$manifest")
  if [ -z "$before" ]; then
    echo "$name: new plugin at $after"
  elif [ "$before" = "$after" ]; then
    echo "::error file=$manifest::$name changed but its version is still $after. Bump it in plugin.json so installs update." >&2
    status=1
  else
    echo "$name: $before -> $after"
  fi
done
exit $status
