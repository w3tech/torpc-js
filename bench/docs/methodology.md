# Methodology

This document describes **what is measured, why, and what is intentionally left out**, in enough
detail that a reader can decide whether to trust the numbers.

> **Scope note.** This describes the **first-generation** harness, which encoded payloads locally
> into four format adapters and compared them. The current harness captures `raw` / `T1` / `T2`
> from a live TORPC endpoint instead, with no local encoder: see [`../README.md`](../README.md) for
> the pipeline that is actually runnable today.
> What carries over unchanged is the doctrine below, deterministic scoring, no LLM judge, pinned
> fixtures, and treating a payload that does not fit the context window as a capacity failure
> rather than a wrong answer. What does not carry over is the format list: `compressed_v1` and the
> envelope it encoded, referred to below as AEP, were a local design that TORPC's tier model
> replaced. AEP is not TORPC, and it is not the Ankr Agent RPC product.

## 1. What this benchmark is

A side-by-side comparison of four RPC-response **format adapters** on identical
queries against identical pinned data. We measure two things:

1. **Token efficiency** — how many tokens the encoded payload consumes in
   GPT-family tokenizers (`o200k_base` for GPT-5/4o, `cl100k_base` for GPT-4).
   Lower = fewer tokens per LLM call = lower cost and lower context-window pressure.
2. **Retrieval accuracy** — given the encoded payload, an LLM answers a question
   about the data. We deterministically score the answer against canonical
   expected values. Higher accuracy = the format preserved the information the
   agent needed.

The composite metric we report is `accuracy_% / avg_tokens × 1000` — same shape
as the TOON benchmark, so cross-comparisons are direct.

## 2. The four formats

| Format | What it is | Content-Type |
|---|---|---|
| `raw_rpc` | Standard JSON-RPC 2.0 envelope around the node's reply, pretty-printed | `application/json` |
| `raw_rpc_toon` | Same content, serialised as [TOON](https://toonformat.dev) | `application/toon` |
| `compressed_v1` | Ankr Agent Envelope Protocol (AEP) — semantic envelope with finality, action classification, truncation flags, raw-data pointer | `application/vnd.ankr.compressed+json;v=1` |
| `compressed_v1_toon` | AEP envelope serialised as TOON | `application/vnd.ankr.compressed+toon;v=1` |

The four combinations let us factor out the contributions of **format** (AEP vs JSON-RPC)
and **serialisation** (TOON vs JSON):

- `raw_rpc` → `raw_rpc_toon`: pure serialisation delta on unstructured RPC reply
- `compressed_v1` → `compressed_v1_toon`: pure serialisation delta on AEP
- `raw_rpc` → `compressed_v1`: pure envelope-design delta (both JSON)
- `raw_rpc` → `compressed_v1_toon`: cumulative gain

Per-format encoding logic lives in `src/formats/{name}.ts`. AEP envelope shape per
method is documented in [`format-specs.md`](format-specs.md).

## 3. Why these formats and not others

- **`raw_rpc` (control)** — baseline a customer gets today from any standard JSON-RPC
  node or AAPI endpoint. If we publish "Ankr's envelope saves N% tokens", the question
  is *vs what*. This is the *what*.
- **`compressed_v1`**: the local AEP encoder, kept as a historical adapter. Per-method
  compressors live in `src/formats/compressed-v1/methods.ts`. In the current harness this role is
  filled by the server itself: T1 and T2 are captured from a TORPC endpoint rather than encoded
  here.
- **TOON variants** — TOON's claim is "compact, schema-aware encoding for LLM prompts".
  We want to check whether TOON applied **after** envelope design adds further gains or
  whether AEP already extracts most of the win. The 4-way matrix isolates this.
- **Not in this run:** `fields_projected` (upper bound — what any format could achieve
  with perfect knowledge of the question), gzip/Brotli (different concern — bytes on
  wire, not tokens in prompt).

## 4. Fixtures — real ETH mainnet, pinned

Every measurement uses one of 15 fixtures captured at **block `21540854`** (early
2025, deeply finalized). All fixtures are committed to the repository as JSON files
under `fixtures/`, so anyone can re-run scoring without RPC access.

| Kind | Count | What it covers |
|---|---|---|
| Wallets (`W1..W5`) | 5 | Whale, high-activity exchange, NFT collector, burn address, contract account |
| Transactions (`T1..T5`) | 5 | Simple ERC-20 transfer, Uniswap V3 swap, NFT mint, failed tx, contract deployment |
| Log ranges (`L1..L3`) | 3 | Small USDC range, wide USDC range (truncation pressure), multi-address |
| Blocks (`B1..B2`) | 2 | Recent reference block, older archive block |

For each wallet we capture `eth_getBalance`, `eth_getTransactionCount`,
`ankr_getAccountBalance`, `ankr_getTokenTransfers`, `ankr_getNFTsByOwner`. For each
transaction: `eth_getTransactionReceipt` and `eth_getTransactionByHash`. Block kind
uses `eth_getBlockByNumber`. Logs use `eth_getLogs`. **`fixtures/<kind>/<ID>/<method>.json`**.

Capture logic — `src/runner/capture-fixtures.ts`. Run only when you want to refresh
fixtures (e.g. at a different pinned block); the existing snapshots are deterministic.

## 5. Question bank — 50 questions × 5 categories

| Category | Count | What it tests |
|---|---|---|
| `retrieval` | 10 | Direct lookups — "what is X?", "how many Y?" |
| `aggregation` | 15 | Sum / count / unique / max — derived from the data |
| `filtering` | 12 | Predicates — "did this tx succeed?", "does this wallet hold USDC?" |
| `semantic` | 10 | Finality, action classification — *AEP advantage zone* |
| `validity` | 3 | Truncation — "is this list complete?" |

The `semantic` category is where `compressed_v1` is expected to **structurally**
outperform `raw_rpc`: AEP carries explicit `finality`, `action`, and `truncated`
fields, while raw JSON-RPC has none of them — the LLM has to infer (often
hallucinating) or refuse.

Full bank in `src/questions/bank.ts`. Each entry has a typed `expected[]` field
with multiple acceptable forms (e.g. `["21540854", "21,540,854"]`) and an `AnswerType`
that drives normalisation.

## 6. Scoring — deterministic, no LLM judge

10 answer types live in `src/scorer/index.ts`. Each normalises both the LLM answer
and every expected value before comparing:

| Type | Normalisation |
|---|---|
| `number` | Strip currency/units/commas, parse float, accept ±1% tolerance |
| `number_signed` | Same as above, but sign must match |
| `integer` | Parse, round, exact match |
| `hex` | Lowercase, exact match |
| `address` | Lowercase, accept truncated `0xabc...123` form |
| `boolean` | Map yes/no/y/n/1/0/true/false to `bool` |
| `boolean_enum` | Either yes/no or one of an enum set |
| `enum` | Lowercase, snake-case, exact match |
| `token_set` | Tokenise; LLM answer must contain all tokens of expected (subset) |
| `freeform` | Last resort: case-insensitive substring match in either direction |

Doctrine: **>95% of questions scored deterministically.** No LLM judges
(LLM-as-judge introduces its own bias). Where the answer is genuinely
free-form, the question is rewritten to fit a typed category.

## 7. Evaluators (LLM providers)

Current default: **Cerebras `gpt-oss-120b`** on the free tier. Why:

- Free tier limits — 30 RPM, 64K TPM, 14.4K RPD, 1M TPD — comfortably covers
  one full run (50 questions × 4 formats = 200 calls, plus ~2 s spacing → ~7 min).
- Cerebras inference latency is `~30 ms`, so wall time is rate-limited, not
  compute-limited — the bench reads honest results without weird outliers.
- The model is a 120B-class open-weights model; results are representative of
  modern long-context agent stacks.

Other evaluators wired but not currently used:

- `src/evaluators/gemini.ts` — uses `gemini-2.5-flash-lite` (kept as fallback)
- Anthropic, OpenAI, Grok — stubs only, not implemented

`temperature=0` is hard-coded. System prompt:

```
You are answering questions about blockchain data.
Read the provided data carefully. Answer concisely — just the value asked for, no explanation.
If the data does not contain the answer, reply with exactly "UNKNOWN".
Do not invent values that are not present in the data.
```

User prompt is `${question.prompt}\n\n=== DATA ===\n${encoded_payload}`.

## 8. The payload-size guard — `PAYLOAD_TOO_LARGE`

Free-tier `gpt-oss-120b` has a **64K TPM** cap, so prompts above ~25K input tokens
are rejected. Many `raw_rpc` payloads on wallet/block/wide-logs fixtures are
40-100K tokens.

We **do not** send those to the LLM. The bench records them as
`PAYLOAD_TOO_LARGE` and counts them as **wrong** in accuracy aggregation.

This is intentional and is part of the methodology: a format that does not fit
in the agent's context window is useless to the agent. Treating overflow as
"unanswered → wrong" is the **fair measurement** of context-window economy. It
is not a handicap.

The 25K cap is in `src/runner/run-bench.ts` (`MAX_INPUT_TOKENS = 25_000`).

When we report results, we always split into two buckets:

- **Apples-to-apples** — only questions where every format fit in the cap. Pure
  comparison of answer quality at equal context.
- **Over-cap reclaim** — questions where `raw_rpc` overflowed but compressed
  formats fit. This is the "context-window saved" effect.

## 9. What we report

Per-format aggregates:

- **Accuracy by category** — `retrieval / aggregation / filtering / semantic / validity`,
  with `n correct / n total` and percentage. Lets us see where format design
  matters (semantic) vs where it doesn't (basic retrieval).
- **Apples accuracy** — accuracy on the subset where all formats fit the context
  window. Honest answer-quality comparison.
- **Over-cap reclaim** — number of questions where `raw_rpc` overflowed and a
  compressed format succeeded.
- **Average payload tokens** (`o200k_base`).
- **Composite efficiency** — `accuracy / avg_tokens × 1000`.

We **do not** report:

- **LLM latency** — Cerebras inference is fast and consistent, the bench is
  rate-limited, so latency tells you nothing about the format.
- **Dollar cost** — depends on each customer's tier and provider; computable
  from token counts.
- **Compression by gzip** — wire-bytes question, different from
  tokens-in-prompt; we are measuring agent context economy, not bandwidth.
- **Per-model differences** in Phase 1 — token counts are identical for
  same-tokenizer-family models.

## 10. Reproducibility guarantees

- Fixtures are pinned to a specific block — same input bytes forever.
- Question bank has canonical expected answers extracted directly from the
  fixtures (no LLM-generated answers).
- Scorer is deterministic — no LLM judge anywhere.
- Tokenizer libraries are version-pinned in `package.json`.
- LLM calls have `temperature=0` (deterministic decoding within a single
  provider), and raw responses are persisted to `results/run-*/raw-llm-responses/`
  for audit.
- Cerebras free tier does not guarantee bit-identical outputs across runs (KV
  caching, batch effects); ~3-5% per-question flip rate is normal. Run-to-run
  aggregates are stable within ±2 percentage points on the 50-question bank.
  This is documented as a known floor; multi-seed runs are a future enhancement.

## 11. Status of this methodology

- The 4-format matrix is implemented.
- The 5-category bank is implemented at 50 questions; spec calls for 300 (see [README §Status](../README.md#status)).
- The 4-tokenizer matrix (o200k / cl100k / Claude / Gemini) per the spec is
  partially implemented — only `gpt-tokenizer` family at present. Claude/Gemini
  native tokenizers are a future enhancement.
- The multi-model evaluator matrix (Cerebras + Anthropic + OpenAI + Google +
  Grok) is partially implemented — only Cerebras and Gemini are wired up.
- The full spec's `fields_projected` upper-bound format is not yet built.

See [README §Status](../README.md#status) for the live checklist.

## 12. Cross-references

- [`../README.md`](../README.md): the current pipeline, the two exam delivery paths, and the known
  measurement limits
- [`reproducing.md`](reproducing.md): step-by-step run instructions for this first-generation suite
- [`format-specs.md`](format-specs.md): AEP envelope shape, TOON serialisation choices
- [`../results/`](../results/): the published measurements, all of them from the current harness.
  Start at [`../results/README.md`](../results/README.md), which states which file may be quoted for
  what.

The write-ups of the individual first-generation runs from May 2026 are not part of this repository.
They report on `compressed_v1` / AEP, a local envelope design that TORPC's tier model replaced, and a
number lifted from them would be attributed to TORPC by mistake. This page is published for the
doctrine in sections 6, 8 and 10, which the current harness still follows.
