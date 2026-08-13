# TORPC public benchmark — retrieval accuracy

Model: `sonnet-4.6-api` · 100 questions × 3 formats = 300 evaluations · deterministic type-aware scoring (no LLM judge).

## Overall (accuracy + composite efficiency)

| format | accuracy | context-overflow | avg tokens (o200k) | efficiency (acc%/1K tok) |
|---|---:|---:|---:|---:|
| raw | 80/100 (80.0%) | 0 | 69,348 | 1.2 |
| T1 | 89/100 (89.0%) | 0 | 54,549 | 1.6 |
| T2 | 92/100 (92.0%) | 0 | 38,998 | 2.4 |

## Accuracy by question category

| category | raw | T1 | T2 |
|---|---:|---:|---:|
| retrieval | 80.3% | 98.4% | 96.7% |
| aggregation | 88.9% | 66.7% | 66.7% |
| filtering | 100.0% | 100.0% | 83.3% |
| structure | 71.4% | 71.4% | 71.4% |
| validity | 100.0% | 100.0% | 100.0% |
| decoding | 66.7% | 66.7% | 100.0% |

## Accuracy by coverage class

| coverage | raw | T1 | T2 |
|---|---:|---:|---:|
| full_t2 | 64/79 (81.0%) | 69/79 (87.3%) | 73/79 (92.4%) |
| partial_t1 | 15/18 (83.3%) | 18/18 (100.0%) | 18/18 (100.0%) |
| unsupported | 1/3 (33.3%) | 2/3 (66.7%) | 1/3 (33.3%) |
