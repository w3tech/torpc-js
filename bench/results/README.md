# bench/results

Benchmark output. Two different kinds of thing live here, and they must not be quoted
interchangeably:

1. **Pinned-corpus runs.** Deterministic, re-runnable offline from the committed fixtures at a
   pinned ETH mainnet block. Use these when you need a number anyone can reproduce byte for byte.
2. **Live-endpoint runs.** Measured against a live public endpoint on a given day. Use these when
   you need to know what the deployed transform actually does. They are dated, and they go stale.

Every claim taken from this folder must carry its scope and its label: which corpus, which tier,
token-weighted or unweighted, and whether tokens were counted over the whole HTTP body or over the
`result` payload only. Mixing those is how a wrong number gets published.

## Pinned-corpus results

| File | What it holds |
|---|---|
| [`BENCHMARK.md`](BENCHMARK.md) | The curated write-up: token efficiency plus retrieval accuracy across raw / T1 / T2 over 114 pinned exam items. Headline: **-45.0%** tokens overall at T2 (o200k). Accuracy is reported in explicit context-fit buckets, never blended with context overflow. |
| [`SUMMARY.md`](SUMMARY.md) | Cross-model summary table behind `BENCHMARK.md`, all buckets and all evaluator paths, including the older tool-assisted rows kept only as a snapshot. |
| [`token-efficiency.md`](token-efficiency.md) | Per-method, per-fixture token counts. Counted over the `result` payload the agent consumes, so these do not equal whole-body counts. |
| [`retrieval-accuracy.md`](retrieval-accuracy.md) | Per-category retrieval accuracy for a single model, 100 questions x 3 tiers. |
| [`retrieval-accuracy-readable99.md`](retrieval-accuracy-readable99.md) | The 99-item subset that survives the sub-agent delivery path, with the exclusion reason spelled out. The two measurement limits are stated in [`../README.md`](../README.md). |
| [`accuracy/*.json`](accuracy/) | Machine-readable per-model scoring output. |

## Live-endpoint results

| File | What it holds |
|---|---|
| [`live-token-savings-2026-07-17.md`](live-token-savings-2026-07-17.md) | 21 methods x 25 random ETH mainnet blocks against a live endpoint, o200k over the full HTTP response body. Headline: **-35.3%** at T1 and **-48.4%** at T2, token-weighted. Coverage was discovered by probing the `Token-Tier` response echo rather than assumed. Reproduce with [`../scripts/live-token-savings.mjs`](../scripts/live-token-savings.mjs). |

## Re-running

Pinned-corpus runs need no network access. Live runs need an RPC key in the environment and are
dated on the day they ran. See [`../README.md`](../README.md) and
[`../docs/reproducing.md`](../docs/reproducing.md).

## Raw-baseline cross-check

[`raw-baseline-crosscheck-2026-07-27.md`](./raw-baseline-crosscheck-2026-07-27.md) checks the
baseline every other number here is measured against: our untransformed tier-0 output against an
independent Ethereum mainnet endpoint, same calls, same tokenizer. Both sides are plain JSON-RPC, so
it is a control on our own raw responses rather than a comparison of providers. Script:
[`../scripts/raw-baseline-crosscheck.mjs`](../scripts/raw-baseline-crosscheck.mjs).
