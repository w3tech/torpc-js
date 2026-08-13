# TORPC benchmark — retrieval accuracy (READABLE-99 subset)

> **Scope.** The sub-agent path delivers each payload to the model under test via the Read tool, which hard-errors on any single line over ~25K tokens (it returns **zero content**, not a truncated prefix — e.g. `793435 tokens exceeds maximum allowed 25000`). 15 of 114 exam items store their payload as one such oversized line — all tiers of `eth_getBlockByHash__pinned_full`, `eth_getBlockByNumber__pinned_full`, `eth_getBlockReceipts__pinned`, `eth_getLogs__L2_usdc_transfers_wide`, `eth_getLogs__L3_all_logs_one_block` — and are unreadable via this path at any tier. They are excluded here (captured as token-efficiency only; see [`token-efficiency.md`](token-efficiency.md)). This subset = 99 items · 81 questions × 3 formats = 243 evaluations.
>
> **This is a delivery limit, not a model result.** Even the most compressed tier of those five items is 63K to 348K `o200k_base` tokens, so compression does not make them fit a 25K-per-line read cap. They are exactly the large-payload items where compression matters most, and a model with a 1M-token context window could ingest them if the bytes were handed to it directly, which is what the API path does. They stay listed here rather than being quietly dropped, because silently removing them would make the accuracy axis look better than the harness earned. The deterministic token-efficiency half of the benchmark is unaffected and stands for all 114 items. See [`../README.md`](../README.md) for both known measurement limits.

## opus-4.8-1m — 240/243 = 98.8%  ·  v2 exam set (adds `primer` + `decoding` questions)

| format | accuracy |
|---|---:|
| raw | 78/81 (96.3%) |
| T1 | 81/81 (100.0%) |
| T2 | 81/81 (100.0%) |

By category: retrieval 162/165 (98.2%), aggregation 18/18, filtering 15/15, structure 6/6, validity 6/6, decoding 33/33.

Misses (3, all `raw` tier — mental hex→decimal slips): `eth_blockNumber__default`, `eth_feeHistory__p5`, `eth_getBalance__s0`. With TORPC-decimalized numbers (T1/T2) the model is perfect (100%). Note the v1 "T1 dip" (prefix-less re-hex-decoding, below) did **not** recur on v2 — T1 = 100%.

---

## Prior run — v1 exam set (70 readable questions / 210 evals, archived)

> v1 had no `primer` and no `decoding` category. Token/efficiency columns below are payload o200k token counts (≈ stable across v1→v2 since the captured payloads are identical).

### opus-4.8-1m — 202/210 = 96.2% (v1)

| format | accuracy | avg tokens (o200k) | efficiency (acc%/1K tok) |
|---|---:|---:|---:|
| raw | 68/70 (97.1%) | 3,579 | 27.1 |
| T1 | 66/70 (94.3%) | 2,939 | 32.1 |
| T2 | 68/70 (97.1%) | 1,705 | 57.0 |

### haiku-4.5 — 191/210 = 91.0% (v1)

| format | accuracy | avg tokens (o200k) | efficiency (acc%/1K tok) |
|---|---:|---:|---:|
| raw | 63/70 (90.0%) | 3,579 | 25.1 |
| T1 | 64/70 (91.4%) | 2,939 | 31.1 |
| T2 | 64/70 (91.4%) | 1,705 | 53.6 |

### v1 reading notes
- **Equal accuracy, ~half the tokens.** Opus T2 matched raw (97.1%) at 1,705 vs 3,579 avg tokens → efficiency 27.1 → 57.0 (2.1×). Same shape for Haiku (25.1 → 53.6).
- **T1 dipped** (Opus 94.3% vs raw 97.1%) because v1 T1 stripped the `0x` prefix and the model sometimes re-hex-decoded a prefix-less decimal. (Did not recur on v2.)
- **Opus > Haiku** overall (96.2% vs 91.0%), widest on filtering (100% vs 60%). haiku-4.5 was not re-run on v2.
