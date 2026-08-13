#!/usr/bin/env bash
# Load the RPC key from a LOCAL env file OUTSIDE the repo (never committed), then run the command.
# Default file: ~/.config/agent-rpc-bench.env   (override with AGENT_RPC_BENCH_ENV=/path)
# The key never lives in the repo — only on your machine / shell.
#
# Usage:  bash scripts/run-with-key.sh pnpm capture:tiers
set -euo pipefail
ENVF="${AGENT_RPC_BENCH_ENV:-$HOME/.config/agent-rpc-bench.env}"
if [ -z "${ANKR_RPC_URL:-}" ] && [ -f "$ENVF" ]; then
  set -a; . "$ENVF"; set +a
fi
if [ -z "${ANKR_RPC_URL:-}" ]; then
  echo "✗ ANKR_RPC_URL not set, and $ENVF not found." >&2
  echo "  Put your key in that file (one line), e.g.:" >&2
  echo "    ANKR_RPC_URL=https://rpc.ankr.com/eth/<YOUR_KEY>" >&2
  echo "    # optional external raw baseline:  RAW_RPC_URL=https://<provider>/<key>" >&2
  echo "  The file is outside the repo and is never committed. Or just: export ANKR_RPC_URL=... before running." >&2
  exit 1
fi
exec "$@"
