# Reproducing the benchmark (first-generation harness)

Step-by-step guide to running the first-generation suite from a clean checkout, for anyone
verifying the 2026-05 published runs.

> **For the current pipeline, read [`../README.md`](../README.md) instead.** The commands below
> drive the earlier four-adapter harness, which encoded payloads locally. The current harness
> captures `raw` / `T1` / `T2` from a live TORPC endpoint via `Accept-Token-Tier` and uses a
> different set of scripts (`capture:tiers`, `questions`, `tokens`, `exam`, `score`). Several script
> names used below (`smoke`, `bench`, `capture`) are no longer declared in `package.json`, so this
> page reads as a record of how the 2026-05 runs were produced rather than as a runnable guide.

## 0. Prerequisites

- **Node `>=22.6.0`** — we use native `--experimental-strip-types` (no tsx/esbuild
  build step). Check: `node --version`.
- **pnpm `>=9.0.0`**. Install via `corepack enable && corepack prepare pnpm@latest --activate`,
  or `npm install -g pnpm`.
- **~50 MB disk** for `node_modules`.
- For Phase 2 only: a **Cerebras API key** (free tier suffices for one run). Sign up at
  [cloud.cerebras.ai](https://cloud.cerebras.ai). The free tier gives 30 RPM / 1M TPD.

You do **not** need ETH RPC access unless you want to re-capture fixtures — the
committed `fixtures/` cover everything for scoring.

## 1. Clone and install

```bash
git clone https://github.com/w3tech/torpc-js.git
cd torpc-js/bench
pnpm install
```

The `prepare` script installs a pre-commit hook that scans staged content for known
secret patterns. This is automatic.

## 2. Configure secrets

Create the env file **outside the repository**:

```bash
mkdir -p ~/.config/agent-rpc-bench
chmod 700 ~/.config/agent-rpc-bench
cat > ~/.config/agent-rpc-bench/secrets.env << 'EOF'
# Required for Phase 2 (accuracy benchmark)
CEREBRAS_API_KEY=csk-...

# Optional — only if you want to re-capture fixtures
# ETH_RPC_URL=https://rpc.ankr.com/eth/<KEY>
# ANKR_AAPI_URL=https://rpc.ankr.com/multichain/<KEY>

# Optional alternative evaluator (currently for fallback)
# GOOGLE_API_KEY=AIza...
EOF
chmod 600 ~/.config/agent-rpc-bench/secrets.env
```

The path is hard-coded in `src/secrets/index.ts`. If you want a different location,
edit it there.

## 3. Smoke test

```bash
pnpm smoke
```

What it does:

- Loads the secrets file and confirms it parses.
- Initialises both tokenizers (`o200k_base`, `cl100k_base`) and counts tokens on a
  small sample to verify they work.
- Skips RPC connectivity if `ETH_RPC_URL` is absent (fixtures are committed, so
  this is fine for scoring-only).

Expected output:

```
✓ secrets file loaded — CEREBRAS_API_KEY is set
✓ tokenizers ready — o200k_base, cl100k_base
✓ tokenized sample payload (12 tokens / 47 bytes)
```

## 4. Phase 1 — token efficiency (no LLM, no cost)

```bash
pnpm tokens
```

What it does:

- Loads all 40 captured samples (15 fixtures × variable methods per fixture).
- For each sample, encodes through all 4 formats (`raw_rpc`, `raw_rpc_toon`,
  `compressed_v1`, `compressed_v1_toon`).
- Counts tokens with both tokenizers.
- Writes `results/run-YYYY-MM-DD/tokens.csv` and `results/run-YYYY-MM-DD/summary.md`.

Run time: ~30 seconds. Cost: $0.

Read `results/run-YYYY-MM-DD/summary.md` for human-readable tables.

## 5. Phase 2 — accuracy via LLM

```bash
pnpm bench
```

What it does:

- Iterates 50 questions × 4 formats = 200 (question, format) pairs.
- For each, encodes the relevant sample, builds the prompt, calls Cerebras
  `gpt-oss-120b` with `temperature=0`, scores the answer deterministically.
- Caches encoded payloads per `(fixture, method, format)`.
- Skips prompts above the **25K input-token cap** (free-tier TPM=64K) — those are
  recorded as `PAYLOAD_TOO_LARGE` and count as wrong. This is the fair measurement
  of context-window economy (see [`methodology.md`](methodology.md#8-the-payload-size-guard--payload_too_large)).
- Writes `results/run-YYYY-MM-DD-accuracy-cerebras-gpt-oss-120b/`:
  - `accuracy.csv` — one row per (question, format) call
  - `summary.md` — accuracy by format × category, composite efficiency, disagreement table
  - `raw-llm-responses/<question>_<format>.json` — per-call audit dump (gitignored)

Run time: ~10 minutes on free tier (200 calls × ~2.1 s spacing for 30 RPM safety).
Cost: $0 on Cerebras free tier (within daily quota).

## 6. Reading the output

`summary.md` has three sections:

### Section 1 — Accuracy by format × category

```
| format               | retrieval | aggregation | filtering | semantic | validity | overall |
|----------------------|-----------|-------------|-----------|----------|----------|---------|
| raw_rpc              | 5/10      | 6/15        | 7/12      | 5/10     | 1/3      | 48.0%   |
| raw_rpc_toon         | ...       | ...         | ...       | ...      | ...      | ...     |
| compressed_v1        | 10/10     | 12/15       | 11/12     | 9/10     | 3/3      | 90.0%   |
| compressed_v1_toon   | ...       | ...         | ...       | ...      | ...      | ...     |
```

The `semantic` column is the AEP advantage zone. Watch for spreads there.

### Section 2 — Composite efficiency

```
| format               | accuracy | avg tokens | efficiency |
|----------------------|----------|------------|------------|
| raw_rpc              | 48.0%    | 44,454     | 0.0108     |
| compressed_v1        | 90.0%    | 1,435      | 0.6274     |
```

`efficiency = accuracy_fraction / avg_tokens × 1000`. Same formula as TOON benchmark.

### Section 3 — Questions where formats disagree

A per-question table showing rows where any format got it right and any got it wrong.
Lets you spot category effects and audit individual cases.

## 7. (Optional) Re-capture fixtures

You only need this if you want to pin a different block, or refresh data:

```bash
# Make sure ETH_RPC_URL and ANKR_AAPI_URL are set in secrets.env
pnpm capture
```

This overwrites `fixtures/`. Capture script edits `src/types/index.ts:PINNED_BLOCK`
to take effect on a different block. Wallet / log / block selectors and tx selection
criteria are in `src/fixtures/registry.ts`.

## 8. Troubleshooting

- **`secrets.env not found`** — wrong path or wrong permissions. Path is
  `~/.config/agent-rpc-bench/secrets.env` and the file must be readable by you.
- **`CEREBRAS_API_KEY missing`** — Phase 2 only. If you only want token counts, skip
  `pnpm bench`.
- **`401 Unauthorized` from Cerebras** — key probably wrong tier or expired. Test in
  curl: `curl https://api.cerebras.ai/v1/chat/completions -H "Authorization: Bearer $CEREBRAS_API_KEY" -d '{"model":"gpt-oss-120b","messages":[{"role":"user","content":"ping"}]}'`
- **Most prompts marked `PAYLOAD_TOO_LARGE`** — expected for `raw_rpc` on wallet/block
  fixtures (40-100K token range). This is the headline finding, not a bug.
- **Different results across runs** — Cerebras free tier doesn't guarantee
  bit-identical outputs (KV caching, batching effects); ~3-5% per-question flip
  rate is normal. Aggregates over 50 questions are stable to ±2pp.

## 9. Extending the bench

- **Add a format adapter** — implement `Format` (`src/types/sample.ts`) and add to the
  `formats` array in `src/runner/run-bench.ts` and `src/runner/count-tokens.ts`.
- **Add an evaluator** — implement a class with `call({ systemPrompt, userPrompt, maxOutputTokens })`
  and swap it in `src/runner/run-bench.ts`. Existing `cerebras.ts` and `gemini.ts` show
  the rate-limit pattern.
- **Add a question** — append to `QUESTIONS` in `src/questions/bank.ts`. Pick an
  `AnswerType` from `src/scorer/index.ts` and supply ≥1 canonical expected value
  extracted from the actual fixture.
- **Pin a different block** — edit `src/types/index.ts:PINNED_BLOCK`, re-run
  `pnpm capture` (needs RPC), update canonical expected answers in `bank.ts`.

## 10. Open issues for external reviewers

- The 25K input-token cap is a property of the **evaluator's free tier**, not of
  the formats. If your model has a wider context window, raise the cap in
  `src/runner/run-bench.ts:MAX_INPUT_TOKENS` and re-run — `raw_rpc` will recover
  some accuracy on the over-cap bucket.
- The question bank is 50, not the spec's 300. If you replicate at 300, expect
  the spread between formats to be qualitatively the same but with tighter error
  bars on category-level accuracy.
- Currently all evaluator calls go to one model. The spec proposes the
  Cerebras / Anthropic / OpenAI / Google / Grok matrix; that is on the roadmap.
