#!/usr/bin/env bash
# Installs git hooks from scripts/*.sh into .git/hooks/.
# Run automatically by `pnpm install` via the "prepare" script.

set -eo pipefail

# Only install if we're in a git repo (skip on fresh CI checkouts that haven't init'd yet).
if [[ ! -d .git ]]; then
  echo "install-hooks: no .git directory, skipping."
  exit 0
fi

mkdir -p .git/hooks

src="scripts/pre-commit-hook.sh"
dst=".git/hooks/pre-commit"

if [[ ! -f "$src" ]]; then
  echo "install-hooks: $src not found, skipping."
  exit 0
fi

cp "$src" "$dst"
chmod +x "$dst"
echo "install-hooks: pre-commit hook installed → $dst"
