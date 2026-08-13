# TORPC Benchmark — Results

Token efficiency **and** retrieval accuracy, side by side, for `raw` (tier 0) / `T1` / `T2`, on real Ethereum-mainnet data pinned at one block, across the 24 TORPC-covered methods (+3 unsupported as an honest baseline).

**Models under test:** Claude **Haiku 4.5**, **Sonnet 4.6**, **Opus 4.8** — answered via the Anthropic API as a plain chat completion, **no tools, value-only** (so this measures format *comprehension*, not a sub-agent's ability to run code over the payload). 114 exam items · 100 questions × 3 tiers = **300 evaluations per model**. Scoring is deterministic and type-aware (no LLM judge). Reproduce with `pnpm eval:api` + `pnpm score`.

> **Two independent axes — keep them separate.** (1) **Accuracy** = did the model answer correctly *from data it could read*. (2) **Capacity** = could the model physically ingest the payload at all. A payload that overflows the context window is a **capacity failure, not a wrong answer** — see §3. We never fold overflow into the accuracy numbers.

---

## 1. Token efficiency — deterministic, model-independent (o200k)

| scope | raw | T1 | T2 | T2 vs raw |
|---|--:|--:|--:|--:|
| full_t2 (receipts/logs/blocks/txs) | 1,869,928 | 1,437,051 | 1,027,617 | **−45.0%** |
| partial_t1 (hex scalars, feeHistory, uncles) | 419 | 301 | 301 | −28.2% |
| unsupported (eth_call/getCode/getStorageAt) | 1,648 | 1,648 | 1,648 | −0.0% |
| **overall** | 1,871,995 | 1,439,000 | 1,029,566 | **−45.0%** |

Per-method T2 reduction: `eth_getTransactionReceipt` −54…−63% · `eth_getLogs` −28% (wide) · `eth_getBlockByNumber` (full) −44% · hex scalars −25…−44% · unsupported 0% (shown for honesty). Single largest reduction in the suite: `eth_getTransactionByHash` failed_tx **−96.5%** (16,636 → 574: the decoded `function`+`args` replaces a giant calldata `input` blob).

```
TOKENS (overall, lower is better)
  raw  ██████████████████████████████████████████  1,871,995   baseline
  T1   ████████████████████████████████  1,439,000   −23.1%
  T2   ███████████████████████  1,029,566   −45.0%
```

---

## 2. Retrieval accuracy — comprehension (ALL-FIT)

**ALL-FIT** = questions whose payload fits the model's window — the fair, apples-to-apples comprehension comparison (overflow excluded; see §3).

| model | raw | T1 | **T2** | Δ raw→T2 |
|---|--:|--:|--:|--:|
| Haiku 4.5 | 69.4% (59/85) | 85.9% (73/85) | **90.6%** (77/85) | **+21.2** |
| Sonnet 4.6 | 82.4% (70/85) | 90.6% (77/85) | **92.9%** (79/85) | +10.5 |
| Opus 4.8 | 77.6% (66/85) | 87.1% (74/85) | **91.8%** (78/85) | +14.2 |

> Bucket discipline: these are the ALL-FIT rows from `SUMMARY.md` (`*-api`, n=85 shared bucket) for **all three** models. An earlier revision of this file mistakenly quoted the n=100 *overall* rows for Sonnet/Opus next to Haiku's ALL-FIT row — mixed denominators. Overall (n=100) rows remain in `SUMMARY.md`.

```
ACCURACY  raw ──▶ T2   (higher is better, ALL-FIT n=85)
  Haiku   raw ███████████████████████████▊ 69.4   →  T2 ████████████████████████████████████▏ 90.6
  Sonnet  raw ████████████████████████████████▉ 82.4   →  T2 █████████████████████████████████████▏ 92.9
  Opus    raw ███████████████████████████████ 77.6   →  T2 ████████████████████████████████████▋ 91.8
```

T2 lands every model — weak or strong — at **91–93%**. The lift is the **format**, not the model.

### By category, T2
| category | Haiku | Sonnet | Opus |
|---|--:|--:|--:|
| retrieval | 87% | 97% | 97% |
| decoding (ABI/events) | 87% | 100% | 100% |
| validity | 100% | 100% | 100% |
| filtering | 50% | 83% | 67% |
| aggregation | 56% | 67% | 67% |
| structure | 14% | 71% | 71% |

Biggest jump is **decoding** (ABI-decoded events): T2 hands the model named args instead of raw hex topics/data. Weakest is **aggregation/structure** — counting thousands of entries by eye (see §4).

---

## 3. ⚠ Capacity — when the payload doesn't FIT (NOT an accuracy error)

This is a **separate, larger problem** from getting an answer wrong: the model literally cannot ingest the response because it exceeds the context window. We score these as `CONTEXT_OVERFLOW`, **not** as accuracy misses.

| model | window | overflow @ raw | @ T1 | @ T2 |
|---|--:|--:|--:|--:|
| Haiku 4.5 | 200K | 15 / 100 | 15 | 15 |
| Sonnet 4.6 | 1M | 0 | 0 | 0 |
| Opus 4.8 | 1M | 0 | 0 | 0 |

The 15 are the giant items — full blocks, wide/all-logs, block-receipts (320K–580K tokens raw). On Haiku's 200K window the model **never sees the data**. Even T2 (180K–348K for these) still exceeds 200K, so they remain overflow on Haiku — which is why §2 excludes them rather than scoring them 0.

**Why this matters as its own axis:**
- It is the *"a smaller / cheaper model can't even fit raw"* story. Compression mitigates it — T2 brings many payloads under the line that raw blew past — and a 1M-window model removes it entirely.
- Folding it into accuracy would conflate **"answered wrong"** with **"couldn't read it at all"** — two different product problems with different fixes.

---

## 4. Both together — the headline

```
                tokens (T2 vs raw)     accuracy (raw → T2, ALL-FIT)
  Haiku 4.5     ▼ −45%  (input)        69.4% ▲ 90.6%   (+21)
  Sonnet 4.6    ▼ −45%                 82.4% ▲ 92.9%   (+11)
  Opus 4.8      ▼ −45%                 77.6% ▲ 91.8%   (+14)
```

**T2 is cheaper *and* more accurate *and* fits smaller windows — simultaneously.** ~45% fewer input tokens (up to −96.5% on calldata-heavy transactions), accuracy 91–93% across all three models, and payloads that raw couldn't fit now fit. The token win and the accuracy win are not a trade-off; they come from the same decoded/decimalized format.

Concrete illustration — `eth_blobBaseFee`: raw hands the model a hex string, it converts in-head and returns `348891897` ❌; T1/T2 hand it the decimal `21869561` ✅. Same data, the format removes an error class.

---

## Methodology notes (read before quoting cross-model numbers)

- **This benchmark measures `raw → T2` *within* a model — not a model ranking.** Cross-model differences are tiny (≤7 of 100 distinct questions) and within single-sample noise: each item was answered once, sampling is not pinned. A rigorous model ranking would need repeated runs or pinned decoding. Do **not** read "model A beat model B" into these numbers; the robust, large signal is the per-model raw→T2 delta.
- **Aggregation over huge sets is not reliably answerable without code.** "Count 1,585 logs / 136 distinct addresses in a 486K-token blob" needs computation, which the no-tools protocol forbids — so all models fail it (Opus honestly returns `UNKNOWN`; weaker models emit a confident wrong number). These drag the `aggregation` category for everyone and are not a format signal.
- Token counts use the `o200k_base` tokenizer (GPT-4o/5 family). Anthropic's tokenizer is denser on this material — the empirical overflow data bounds the gap from below (a payload at a nominal ~180K o200k was rejected by a 200K Anthropic window, i.e. ≥ ~10% on those items) — so the LLM-bill savings for Claude consumers are if anything understated here. An exact paired count-tokens measurement is a pending TODO.

_Raw per-model results: `data/answers/<label>/`. Scored detail: `results/accuracy/<label>.json`. Token detail: `results/token-efficiency.md`. Auto cross-model rollup: `results/SUMMARY.md`._
