# TORPC public benchmark — cross-model SUMMARY

Compare **our own tiers** raw / T1 / T2. Accuracy is **bucketed by context fit** so small-model overflow does not get mixed with comprehension.

> ⚠️ **Methodology.** Token-efficiency (below / `token-efficiency.md`) is deterministic. Headline accuracy is the **API path** (`*-api` rows / `pnpm eval:api`) — plain chat-completion, **no tools, value-only**, identical for every model; curated write-up in `BENCHMARK.md`. The older **subscription / sub-agent** rows are tool-assisted (sonnet could parse payloads with code) and **not comparable** — kept only as a snapshot. Accuracy measures **raw→T2 within a model**, not a cross-model ranking (single-sample). `CONTEXT_OVERFLOW` is a **capacity** signal, never an accuracy miss.

## Token efficiency (o200k, model-independent)

| scope | raw | T1 | T2 | T2 vs raw |
|---|--:|--:|--:|--:|
| full_t2 | 1,869,928 | 1,437,051 | 1,027,617 | −45.0% |
| partial_t1 | 419 | 301 | 301 | −28.2% |
| unsupported | 1,648 | 1,648 | 1,648 | −0.0% |
| **overall** | 1,871,995 | 1,439,000 | 1,029,566 | **−45.0%** |

## haiku-4.5-api  _(ctx ~200K)_

| bucket | n | raw | T1 | T2 |
|---|--:|--:|--:|--:|
| ALL-FIT (apples-to-apples) | 85 | 69.4% | 85.9% | 90.6% |
| TOO-BIG (even T2 overflows) | 15 | 0.0% | 0.0% | 0.0% |
| overall | 100 | 59.0% | 73.0% | 77.0% |
| empirical context-overflow | — | 15 | 15 | 15 |

## haiku-4.5  _(ctx ~200K)_

| bucket | n | raw | T1 | T2 |
|---|--:|--:|--:|--:|
| ALL-FIT (apples-to-apples) | 85 | 71.8% | 89.4% | 91.8% |
| TOO-BIG (even T2 overflows) | 15 | 100.0% | 100.0% | 93.3% |
| overall | 100 | 76.0% | 91.0% | 92.0% |

## opus-4.8-1m  _(ctx ~1000K)_

| bucket | n | raw | T1 | T2 |
|---|--:|--:|--:|--:|
| ALL-FIT (apples-to-apples) | 100 | 80.0% | 81.0% | 81.0% |
| overall | 100 | 80.0% | 81.0% | 81.0% |

## opus-4.8-api  _(ctx ~200K)_

| bucket | n | raw | T1 | T2 |
|---|--:|--:|--:|--:|
| ALL-FIT (apples-to-apples) | 85 | 77.6% | 87.1% | 91.8% |
| TOO-BIG (even T2 overflows) | 15 | 60.0% | 86.7% | 86.7% |
| overall | 100 | 75.0% | 87.0% | 91.0% |

## sonnet-4.6-api  _(ctx ~200K)_

| bucket | n | raw | T1 | T2 |
|---|--:|--:|--:|--:|
| ALL-FIT (apples-to-apples) | 85 | 82.4% | 90.6% | 92.9% |
| TOO-BIG (even T2 overflows) | 15 | 66.7% | 80.0% | 86.7% |
| overall | 100 | 80.0% | 89.0% | 92.0% |

## sonnet-4.6  _(ctx ~200K)_

| bucket | n | raw | T1 | T2 |
|---|--:|--:|--:|--:|
| ALL-FIT (apples-to-apples) | 85 | 100.0% | 100.0% | 100.0% |
| TOO-BIG (even T2 overflows) | 15 | 100.0% | 100.0% | 100.0% |
| overall | 100 | 100.0% | 100.0% | 100.0% |

## Cross-model — ALL-FIT bucket (fair comprehension comparison)

| model | raw | T1 | T2 |
|---|--:|--:|--:|
| haiku-4.5-api | 69.4% | 85.9% | 90.6% |
| haiku-4.5 | 71.8% | 89.4% | 91.8% |
| opus-4.8-1m | 80.0% | 81.0% | 81.0% |
| opus-4.8-api | 77.6% | 87.1% | 91.8% |
| sonnet-4.6-api | 82.4% | 90.6% | 92.9% |
| sonnet-4.6 | 100.0% | 100.0% | 100.0% |

> Notes: ALL-FIT = questions whose raw payload fits the model context (×0.9). COMP-ENABLED is where compression lets a model answer that raw can't fit. TOO-BIG = even T2 exceeds the window (need a bigger-context model or smaller payload).
