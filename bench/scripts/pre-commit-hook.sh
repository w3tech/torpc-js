#!/usr/bin/env bash
# Pre-commit hook for agent-rpc-bench.
# Blocks commits that contain known secret patterns OR sensitive filenames.
# Installed via scripts/install-hooks.sh into .git/hooks/pre-commit.

set -eo pipefail

REJECT=0
REASONS=()

# --- secret content patterns -------------------------------------------------
# Each pattern must match a single line of staged diff content.
declare -a PATTERNS=(
  'sk-ant-[A-Za-z0-9_-]{40,}'              # Anthropic API keys
  'sk-proj-[A-Za-z0-9_-]{40,}'             # OpenAI project keys
  'sk-svcacct-[A-Za-z0-9_-]{40,}'          # OpenAI service-account keys
  'sk-[A-Za-z0-9]{48,}'                    # OpenAI legacy keys
  'AIza[A-Za-z0-9_-]{30,}'                 # Google API keys
  'xai-[A-Za-z0-9_-]{40,}'                 # XAI keys
  'rpc\.ankr\.com/[A-Za-z0-9_-]+/[a-f0-9]{40,}'   # Ankr URL with key in path
  'rpc\.ankr\.com/multichain/[a-f0-9]{40,}'       # Ankr AAPI URL with key
)

# --- sensitive filenames -----------------------------------------------------
# Anchored where it matters: a `secrets/` module directory inside src/ is fine,
# but a top-level secrets/ blob with raw credentials is not.
declare -a FILE_PATTERNS=(
  '(^|/)\.env$'
  '(^|/)\.env\.'
  '(^|/)secrets\.env$'
  '^secrets/'
  '\.(key|pem|p12)$'
  'credentials\.json$'
)

# --- check 1: filenames ------------------------------------------------------
staged_files=$(git diff --cached --name-only --diff-filter=ACMR)
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  for fp in "${FILE_PATTERNS[@]}"; do
    if [[ "$f" =~ $fp ]]; then
      REASONS+=("filename matches /$fp/: $f")
      REJECT=1
    fi
  done
done <<< "$staged_files"

# --- check 2: content patterns ----------------------------------------------
# Use `git diff --cached -U0` to scan only added/modified lines.
staged_diff=$(git diff --cached -U0 --no-color || true)
for pat in "${PATTERNS[@]}"; do
  matches=$(echo "$staged_diff" | grep -E "^\+" | grep -E "$pat" || true)
  if [[ -n "$matches" ]]; then
    # do NOT echo the matched line — could leak the secret to console / hook log
    count=$(echo "$matches" | wc -l)
    REASONS+=("content matches /$pat/ — $count line(s) in staged diff")
    REJECT=1
  fi
done

# --- check 3: lint + format + typecheck on staged bench/ TS+JS ---------------
# Only runs when there are staged changes inside bench/ — otherwise specs-only
# commits don't pay the lint cost.
bench_changes=$(echo "$staged_files" | grep -E '^bench/.*\.(ts|js|json)$' || true)
if [[ -n "$bench_changes" ]]; then
  repo_root=$(git rev-parse --show-toplevel)
  if ! ( cd "$repo_root/bench" && pnpm -s check ); then
    REASONS+=("\`pnpm check\` failed in bench/ (typecheck / lint / format)")
    REJECT=1
  fi
fi

# --- final verdict -----------------------------------------------------------
if [[ $REJECT -ne 0 ]]; then
  echo ""
  echo "✗ pre-commit hook: refusing to commit."
  echo ""
  for r in "${REASONS[@]}"; do
    echo "  • $r"
  done
  echo ""
  echo "Either remove the offending files/content from staging,"
  echo "or — only if you are absolutely sure this is a false positive —"
  echo "bypass with:  git commit --no-verify  (NOT RECOMMENDED)"
  echo ""
  exit 1
fi

exit 0
