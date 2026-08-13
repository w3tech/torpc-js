# TORPC benchmark harness

Reproducible benchmark for **TORPC (Token Optimized RPC)**: how much does the transform actually
save, and can a model still answer questions from the compressed payload? Two axes, measured side
by side on real Ethereum mainnet data.

- **Token efficiency**, deterministic and model independent. Payload size in `o200k_base`
  (GPT-5 / 4o family) and `cl100k_base` (GPT-4 family).
- **Retrieval accuracy**, model dependent. A model answers deterministically scored questions from
  the payload alone, no tools, value only.

The three compared payloads are **not** produced by a local encoder. They are captured from a
TORPC endpoint by asking for `Accept-Token-Tier: 0`, `1` and `2` and keeping what the server
returns. So the comparison is against real server output, and the server's `Token-Tier` response
echo is also its coverage declaration.

Methodology follows the [TOON benchmark](https://toonformat.dev/guide/benchmarks.html) shape, with
blockchain-specific data and question categories.

This harness is part of the code repository, Apache-2.0. The specification it measures is in
[w3tech/torpc](https://github.com/w3tech/torpc) under CC0 1.0.

## Start here

- **This page** is the pipeline, end to end: the quick start below, then
  [Endpoint and key](#endpoint-and-key), [Answering the exam](#answering-the-exam),
  [On the method count](#on-the-method-count) and
  [Known measurement limits](#known-measurement-limits).
- [`results/README.md`](results/README.md): what each results file holds and how its numbers may be
  quoted. Read it before quoting any number: whole-body counts and `result`-payload counts are not
  the same measurement, and neither is a live-endpoint run on a given day.
- [`docs/methodology.md`](docs/methodology.md): the measurement doctrine. Written for the earlier
  harness generation, see the note at its top.

## Quick start

Requires Node 22.6 or newer (native `--experimental-strip-types`, no build step) and pnpm 9 or
newer.

```bash
pnpm install
pnpm capture:tiers   # raw / T1 / T2 from a TORPC endpoint  → data/fixtures/   (needs a key)
pnpm questions       # ground truth derived from raw         → data/questions.json
pnpm tokens          # deterministic token report            → results/token-efficiency.md
                     #                                        + data/tokens.json
pnpm exam            # model-facing exam, no ground truth    → data/exam/
# ...answer the exam, see below...
pnpm score -- --model "<label>"   # → results/accuracy/<label>.json
                                  #   + results/retrieval-accuracy.md
```

Only `capture:tiers` needs network access or a key. Everything downstream runs offline against the
committed `data/`. Token efficiency needs no model and costs nothing.

The one live-endpoint measurement is a separate, self-contained script rather than a pipeline stage:

```bash
ANKR_RPC_KEY=<your-key> node scripts/live-token-savings.mjs
```

It probes coverage, then measures raw / T1 / T2 over randomly drawn recent blocks. See
[`results/live-token-savings-2026-07-17.md`](results/live-token-savings-2026-07-17.md) for the
published run and the exact invocation.

## Endpoint and key

The capture step is the only step that needs network access or a key.

```bash
export ANKR_RPC_URL="https://rpc.ankr.com/eth/<YOUR_KEY>"
pnpm capture:tiers
```

- Set `ANKR_RPC_URL` explicitly to the endpoint you want to measure. Do not rely on the built-in
  URL template default.
- `RAW_RPC_URL` is optional: any standard ETH JSON-RPC endpoint, used as an external raw baseline.
- `PINNED_BLOCK` is optional: a decimal block number, overriding the default in
  `src/fixtures/manifest.ts`.

**Keep the key out of the repository.** Either export it in your shell, or put it in a file outside
the repository. The loader checks `$AGENT_RPC_BENCH_ENV` first, then
`~/.config/agent-rpc-bench/secrets.env`, then `~/.config/agent-rpc-bench.env`, and it loads
whichever exists. Nothing under the repository is ever read for secrets.

Defence in depth, so a key cannot leak through a commit:

- `.gitignore` blocks `.env`, `.env.*`, `secrets.env`, `*.key`, `*.pem`, `credentials.json`,
  `secrets/` and `private/`.
- `scripts/pre-commit-hook.sh` scans staged content for known token patterns and for
  RPC-URL-with-key shapes. It is installed automatically by the `prepare` script on
  `pnpm install`.
- Every URL is logged through `redactUrl()`, which replaces key-shaped path segments and secret
  query parameters with `<KEY>`.

Captured payloads, the generated questions, the exam and the answers all land under `data/` and are
committed, so anyone can re-run scoring with no key and no network access. Only per-call raw model
dumps are excluded, because they echo whole payloads back.

## Answering the exam

`pnpm exam` writes the model-facing exam with the ground truth stripped. Getting it answered is the
one step the harness cannot do for you. There are two delivery paths, they are **not**
interchangeable, and a comparison that mixes them is not a comparison.

- **API path (headline).** Set `API_BASE_URL`, `API_KEY` and `API_MODEL` for any OpenAI-compatible
  endpoint, run `pnpm eval:api`, then `pnpm score`. This is a plain chat completion: no tools, value
  only, the payload straight in the prompt, identical shape for every model. Use this for published
  numbers. An Anthropic-native variant of the same path is `API_PROVIDER=anthropic` with
  `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- **In-session path (snapshot).** Answer the exam inside an agent session, one isolated sub-agent per
  item, writing `data/answers/<model>/`. A tool-assisted session can compute over a payload instead
  of reading it, so these rows measure something else and are kept only as a snapshot. This path also
  runs into a payload-size limit, see [Known measurement limits](#known-measurement-limits).

Answer protocol, identical on both paths: answer from the payload only, value only, `UNKNOWN` when
the payload does not contain it, and no tools or scripts for computing the answer.

Then score each model in its own run and commit its `results/accuracy/<model>.json`. `pnpm
consolidate` rolls several models up into one cross-model table.

## Layout

```
bench/
├── README.md                  this page: pipeline, coverage, known limits
├── src/
│   ├── fixtures/manifest.ts   what to capture: methods, tiers, samples, pinned block
│   ├── runner/
│   │   ├── capture-tiers.ts   raw / T1 / T2 capture via Accept-Token-Tier
│   │   ├── token-bench.ts     deterministic token report
│   │   ├── build-exam.ts      model-facing exam, ground truth stripped
│   │   ├── run-api.ts         answer the exam via an OpenAI-compatible endpoint
│   │   ├── score-answers.ts   deterministic scoring
│   │   ├── consolidate.ts     cross-model roll-up
│   │   └── rpc-client.ts      tier-aware JSON-RPC client
│   ├── questions/             question bank + ground-truth generation
│   ├── scorer/                type-aware answer matchers, no LLM judge
│   ├── tokenizers/            o200k_base + cl100k_base wrappers
│   ├── secrets/               env / local-file key loader + URL redaction
│   └── formats/               earlier-generation local encoder, superseded by tier capture
├── scripts/
│   ├── live-token-savings.mjs   live-endpoint measurement over the covered method set
│   ├── run-with-key.sh             load the local env file, then run a command
│   └── pre-commit-hook.sh          staged-content secret scan
├── docs/                      methodology and format notes
├── results/                   measurement output (see results/README.md)
├── data/                      captured tiers, questions, exam, answers (committed)
└── fixtures/                  earlier-generation pinned fixtures, kept for traceability
```

## Headline results

Every number below carries the corpus it was measured on. They are not interchangeable.

| Source | Scope | Result |
|---|---|---|
| [`results/BENCHMARK.md`](results/BENCHMARK.md) | Pinned corpus, 114 exam items, `o200k_base` over the `result` payload | **-45.0%** tokens at T2 vs raw |
| [`results/live-token-savings-2026-07-17.md`](results/live-token-savings-2026-07-17.md) | Live endpoint, 2026-07-17, 21 measured methods x 25 random ETH mainnet blocks, `o200k_base` over the full HTTP body, token-weighted | **-35.3%** at T1, **-48.4%** at T2 |

Accuracy is always reported in explicit context-fit buckets. A payload that does not fit the
model's context window is a capacity failure, not a wrong answer, and the two are never blended.

### On the method count

The transformable set is **23 methods**, and the two corpora count it the same way even though they
label the tiers differently:

- `src/fixtures/manifest.ts` declares 8 methods in `FULL_T2_METHODS` and 15 in
  `PARTIAL_T1_METHODS`, so 23 transformable plus 3 unsupported controls.
- The live probe of 2026-07-17 found 10 methods answering at tier 2 and 13 at tier 1, also 23. The
  difference is the two uncle-by-index methods: the endpoint echoes tier 2 for them, while the
  manifest classes them T1 because they return `null` on post-merge mainnet and so yield nothing
  measurable at either tier.
- Of the 23, the live run measured 21. The same two uncle methods produce no triple.

One known discrepancy, recorded rather than hidden: `results/BENCHMARK.md` opens with "24
TORPC-covered methods". That count matches neither the manifest it was generated from nor the live
probe. Read 23, and treat the line in `BENCHMARK.md` as a pending correction.

## Status

Working:

- Tier capture from a live TORPC endpoint, with coverage discovered by probing the `Token-Tier`
  echo rather than assumed
- Deterministic token report across raw / T1 / T2, both tokenizers
- Ground-truth generation from the raw tier, so expected answers are never model generated
- Type-aware deterministic scorer, no LLM judge anywhere
- Exam delivery through an OpenAI-compatible API path and through an in-session path
- Cross-model consolidation

Not yet:

- The 15 largest exam items are excluded from the accuracy axis by a delivery-path limit, not by a
  model limit. See [Known measurement limits](#known-measurement-limits).
- Claude and Gemini native tokenizers. Currently the `gpt-tokenizer` family only.
- Array sub-variants (`+tabular`, `+aggregate`), which the spec defers past v1, so there is nothing
  to measure yet.
- Chains other than Ethereum mainnet.
- `fields_projected`, an upper-bound control showing what any format could achieve with perfect
  knowledge of the question.

## Known measurement limits

Two of them. Both are properties of how the exam is built and delivered rather than defects in a
particular run, and both are stated here so nobody reads an affected number as a model result.

### 1. The largest exam items cannot be delivered through the in-session path

Exam payloads are stored as a single escaped-JSON-string line. The in-session path reaches the model
by reading that file, and the read tool paginates by line with a cap around 25,000 tokens, so an item
whose payload exceeds the cap cannot be surfaced at any offset. The protocol forbids tools for
computing answers, so a sub-agent that hits this has no legitimate fallback and correctly returns
`UNKNOWN`.

Affected: **15 of the 114 items, at every tier.** All three tiers of
`eth_getBlockByHash__pinned_full`, `eth_getBlockByNumber__pinned_full`,
`eth_getBlockReceipts__pinned`, `eth_getLogs__L2_usdc_transfers_wide` and
`eth_getLogs__L3_all_logs_one_block`. Even their most compressed tier runs 63K to 348K `o200k_base`
tokens, so compression does not make them fit this path.

These 15 are exactly the large-payload items where compression matters most, which makes the effect
worth naming precisely: **it is a delivery limit, not a model result.** A model with a 1M-token
context window could ingest 581K tokens if the bytes were handed to it, which is what the API path
does. What the published record therefore does, as a stopgap: every model is scored on the same **99
readable items** for a fair head-to-head, in
[`results/retrieval-accuracy-readable99.md`](results/retrieval-accuracy-readable99.md), and the 15
are flagged as token-efficiency-only. The auto-generated
[`results/retrieval-accuracy.md`](results/retrieval-accuracy.md) carries a caveat banner because its
overall figure still counts them as wrong, and the per-model JSON under `results/accuracy/` keeps
every row including the empty ones. Whichever way this is eventually fixed, the affected items stay
visible: silently dropping them would make the accuracy axis look better than the harness earned.

The deterministic token-efficiency half of the benchmark
([`results/token-efficiency.md`](results/token-efficiency.md)) is unaffected and stands for all 114
items.

### 2. T1 drops the `0x` prefix, so a model may re-decode a decimal as hex

T1 converts hex quantities to decimal but emits them without a `0x` prefix. When the decimal happens
to be plausible hex, a model correctly following the JSON-RPC convention "this method returns a hex
quantity" sometimes decodes it a second time. Two observed cases:
`eth_getBlockTransactionCountByNumber` raw `0xf4`, that is 244, read as 580 (`0x244`); and
`eth_getTransactionCount` raw `0x1708`, that is 5896, read as 22678 (`0x5896`).

This is why T1 accuracy can dip below both raw and T2, concentrated in the filtering and aggregation
categories. **T2 does not suffer from it**: its added field structure and names stop the model
guessing hex. So the dip is an attributable property of the T1 representation, not run-to-run noise.
It is reported rather than smoothed over, because a consumer ambiguity that a benchmark hides is a
consumer ambiguity that ships. On the current v2 exam set it did not recur, which is recorded
alongside the run in
[`results/retrieval-accuracy-readable99.md`](results/retrieval-accuracy-readable99.md).

## Licence

**Apache-2.0**, as with everything else in this repository. Copyright Web3 Technologies, Inc.
(dba Ankr).

The specification, the conformance vectors and the whitepaper live in
[w3tech/torpc](https://github.com/w3tech/torpc) under CC0 1.0.
