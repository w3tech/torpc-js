# TORPC public benchmark — token efficiency (raw / T1 / T2)

Tokens via `gpt-tokenizer` `o200k_base`, measured on the `result` payload the agent consumes. Savings shown vs **raw (tier 0)**. Captured from the production proxy with `Accept-Token-Tier: 0|1|2`.

## FULL T2 (ABI-decoded) — where compression matters most

| method | sample | raw tok | T1 tok | T1 Δ | T2 tok | T2 Δ |
|---|---|---:|---:|---:|---:|---:|
| `eth_getBlockByHash` | pinned_full | 322,066 | 275,352 | 14.5% | 180,138 | 44.1% |
| `eth_getBlockByNumber` | pinned_full | 322,066 | 275,352 | 14.5% | 180,138 | 44.1% |
| `eth_getBlockReceipts` | pinned | 581,222 | 310,986 | 46.5% | 220,500 | 62.1% |
| `eth_getLogs` | L1_usdc_transfers_narrow | 14,340 | 12,886 | 10.1% | 10,380 | 27.6% |
| `eth_getLogs` | L2_usdc_transfers_wide | 86,756 | 77,776 | 10.4% | 62,577 | 27.9% |
| `eth_getLogs` | L3_all_logs_one_block | 486,432 | 438,111 | 9.9% | 347,625 | 28.5% |
| `eth_getTransactionByBlockHashAndIndex` | idx0 | 512 | 376 | 26.6% | 314 | 38.7% |
| `eth_getTransactionByBlockNumberAndIndex` | idx0 | 512 | 376 | 26.6% | 314 | 38.7% |
| `eth_getTransactionByHash` | contract_deployment | 8,756 | 8,617 | 1.6% | 8,617 | 1.6% |
| `eth_getTransactionByHash` | failed_tx | 16,636 | 16,501 | 0.8% | 574 | 96.5% |
| `eth_getTransactionByHash` | nft_mint | 3,749 | 3,615 | 3.6% | 3,232 | 13.8% |
| `eth_getTransactionByHash` | simple_erc20_transfer | 398 | 262 | 34.2% | 246 | 38.2% |
| `eth_getTransactionByHash` | uniswap_v3_swap | 4,984 | 4,855 | 2.6% | 4,861 | 2.5% |
| `eth_getTransactionReceipt` | contract_deployment | 390 | 178 | 54.4% | 178 | 54.4% |
| `eth_getTransactionReceipt` | failed_tx | 385 | 170 | 55.8% | 170 | 55.8% |
| `eth_getTransactionReceipt` | nft_mint | 14,028 | 7,877 | 43.8% | 5,195 | 63.0% |
| `eth_getTransactionReceipt` | simple_erc20_transfer | 661 | 313 | 52.6% | 267 | 59.6% |
| `eth_getTransactionReceipt` | uniswap_v3_swap | 6,035 | 3,448 | 42.9% | 2,291 | 62.0% |
| **subtotal** | | **1,869,928** | **1,437,051** | **23.1%** | **1,027,617** | **45.0%** |

## PARTIAL T1 (hex→dec only; T2 == T1 expected)

| method | sample | raw tok | T1 tok | T1 Δ | T2 tok | T2 Δ |
|---|---|---:|---:|---:|---:|---:|
| `eth_blobBaseFee` | default | 9 | 5 | 44.4% | 5 | 44.4% |
| `eth_blockNumber` | default | 8 | 5 | 37.5% | 5 | 37.5% |
| `eth_chainId` | default | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_estimateGas` | transfer | 7 | 4 | 42.9% | 4 | 42.9% |
| `eth_feeHistory` | p5 | 324 | 241 | 25.6% | 241 | 25.6% |
| `eth_gasPrice` | default | 8 | 5 | 37.5% | 5 | 37.5% |
| `eth_getBalance` | s0 | 14 | 9 | 35.7% | 9 | 35.7% |
| `eth_getBalance` | s1 | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_getBlockTransactionCountByHash` | default | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_getBlockTransactionCountByNumber` | default | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_getTransactionCount` | s0 | 6 | 4 | 33.3% | 4 | 33.3% |
| `eth_getTransactionCount` | s1 | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_getUncleByBlockHashAndIndex` | idx0 | 1 | 1 | 0.0% | 1 | 0.0% |
| `eth_getUncleByBlockNumberAndIndex` | idx0 | 1 | 1 | 0.0% | 1 | 0.0% |
| `eth_getUncleCountByBlockHash` | default | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_getUncleCountByBlockNumber` | default | 5 | 3 | 40.0% | 3 | 40.0% |
| `eth_maxPriorityFeePerGas` | default | 6 | 5 | 16.7% | 5 | 16.7% |
| **subtotal** | | **419** | **301** | **28.2%** | **301** | **28.2%** |

## UNSUPPORTED (raw-only baseline; raw == T1 == T2 expected)

| method | sample | raw tok | T1 tok | T1 Δ | T2 tok | T2 Δ |
|---|---|---:|---:|---:|---:|---:|
| `eth_call` | usdc_balanceof | 28 | 28 | 0.0% | 28 | 0.0% |
| `eth_getCode` | usdc | 1,584 | 1,584 | 0.0% | 1,584 | 0.0% |
| `eth_getStorageAt` | usdc_slot0 | 36 | 36 | 0.0% | 36 | 0.0% |
| **subtotal** | | **1,648** | **1,648** | **0.0%** | **1,648** | **0.0%** |

## Overall

| | raw | T1 | T2 |
|---|---:|---:|---:|
| tokens | 1,871,995 | 1,439,000 | 1,029,566 |
| savings vs raw | — | 23.1% | 45.0% |

## Token efficiency — chart (TOON-style)

```
OVERALL
  raw  ██████████████████████████████████████████   1,871,995  baseline
  T1   ████████████████████████████████   1,439,000  23.1% smaller
  T2   ███████████████████████   1,029,566  45.0% smaller

FULL-T2 methods (receipts / logs / blocks / txs)
  raw  ██████████████████████████████████████████   1,869,928  baseline
  T1   ████████████████████████████████   1,437,051  23.1% smaller
  T2   ███████████████████████   1,027,617  45.0% smaller

PARTIAL-T1 methods (hex scalars)
  raw  ██████████████████████████████████████████         419  baseline
  T1   ██████████████████████████████         301  28.2% smaller
  T2   ██████████████████████████████         301  28.2% smaller
```
