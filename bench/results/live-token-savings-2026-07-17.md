# Live token savings, 2026-07-17: full covered set, canonical headers

End-to-end measurement of the TORPC transform against a live public Ankr EVM endpoint, over
every method that answers with a transformed tier. Coverage is discovered by live probe rather
than assumed, using the canonical `Accept-Token-Tier` request header and its `Token-Tier`
response echo.

| | |
|---|---|
| **Date** | 2026-07-17 (head block 25,553,250) |
| **Endpoint** | `https://rpc.ankr.com/eth/<key>` |
| **Tokenizer** | `o200k_base` (`gpt-tokenizer`), counted over the full HTTP response body |
| **Script** | [`../scripts/live-token-savings.mjs`](../scripts/live-token-savings.mjs), deterministic block selection (LCG, seed 42) |

## Headline

Across **21 measured methods x 25 random ETH-mainnet blocks** from the last ~1M-block window
(525 raw/T1/T2 triples; a triple is skipped if any leg errors or returns an empty or null result):

| | T1 (mechanical) | T2 (+ ABI decode) |
|---|---:|---:|
| **Overall token reduction vs raw** (token-weighted) | **-35.3%** | **-48.4%** |
| Unweighted per-method mean | -17.4% | -24.5% |
| Best per-method | `eth_getTransactionReceipt` -48.0% | `eth_getTransactionByHash` **-69.0%** |
| Heavy-tail per-method | `eth_getBlockReceipts` -47.6% | `eth_getTransactionReceipt` **-64.5%** |
| Lowest per-method | `eth_getTransactionByHash` -7.4% | scalars about -9 to -19% |

Token-weighted vs unweighted: the weighted overall is dominated by the giant payloads (block
receipts, full blocks), while the unweighted mean is dragged down by the 13 scalar methods whose
absolute payloads are around 20 tokens. Both are reported. Quote whichever matches the claim being
made, and always with its label.

Consistency check: an earlier and narrower run of the same protocol, six methods on 2026-05-27
against the pre-canonical `X-Rpc-Compress` header, measured -34.0% at T1 and -45.6% at T2. This run
lands at -35.3% and -48.4% with much wider coverage. The transform's overall shape is stable across
seven weeks, a header migration, and a 6 to 21 method expansion.

## Coverage (live probe, `Accept-Token-Tier` echo)

Every candidate method was probed with `Accept-Token-Tier: 2` and then `: 1`. The `Token-Tier`
response echo is the server's own coverage declaration.

| Tier reached | Methods |
|---|---|
| **2** (10) | `eth_getTransactionReceipt`, `eth_getTransactionByHash`, `eth_getBlockByNumber`, `eth_getBlockByHash`, `eth_getBlockReceipts`, `eth_getLogs`, `eth_getTransactionByBlockNumberAndIndex`, `eth_getTransactionByBlockHashAndIndex`, `eth_getUncleByBlockNumberAndIndex`, `eth_getUncleByBlockHashAndIndex` |
| **1** (13) | `eth_blockNumber`, `eth_chainId`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_blobBaseFee`, `eth_getBalance`, `eth_getTransactionCount`, `eth_getBlockTransactionCountByNumber`, `eth_getBlockTransactionCountByHash`, `eth_getUncleCountByBlockNumber`, `eth_getUncleCountByBlockHash`, `eth_estimateGas`, `eth_feeHistory` |
| **0** (echo present, untransformed) | `eth_call`, `eth_getCode`, `eth_getStorageAt`, `net_version`, `web3_clientVersion`, `eth_syncing` |

Total transformable on the measured deployment: **23 methods** (10 at T2, 13 at T1). The two uncle
methods echo T2 but return `null` on post-merge mainnet blocks, so they produce no measurable
triples. That leaves 21 methods carrying the measurement.

Also verified during the probe: JSON-RPC **error** responses pass through verbatim and carry
`Token-Tier: 0`. A transport-level failure (HTTP 401 from a bad key) is not a JSON-RPC response at
all and carries no tier header.

## Per-method results

| method | n | avg raw tok | avg T1 | avg T2 | T1 delta | T2 delta | p50 raw ms | p50 T2 ms |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| `eth_getBlockReceipts` | 25 | 384,235 | 201,310 | 152,562 | -47.6% | -60.3% | 117 | 133 |
| `eth_getBlockByNumber` (full) | 25 | 231,032 | 167,189 | 137,781 | -27.6% | -40.4% | 190 | 115 |
| `eth_getBlockByHash` (full) | 25 | 231,032 | 167,189 | 137,781 | -27.6% | -40.4% | 128 | 125 |
| `eth_getLogs` (3-blk, ERC-20 Transfer) | 25 | 48,342 | 42,948 | 34,378 | -11.2% | -28.9% | 81 | 74 |
| `eth_getTransactionReceipt` | 25 | 4,570 | 2,376 | 1,624 | -48.0% | -64.5% | 72 | 67 |
| `eth_getTransactionByHash` | 25 | 1,819 | 1,685 | 564 | -7.4% | -69.0% | 56 | 57 |
| `eth_getTransactionByBlockNumberAndIndex` | 25 | 824 | 691 | 636 | -16.1% | -22.8% | 56 | 55 |
| `eth_getTransactionByBlockHashAndIndex` | 25 | 824 | 691 | 636 | -16.1% | -22.8% | 61 | 56 |
| `eth_feeHistory` | 25 | 242 | 188 | 188 | -22.2% | -22.2% | 68 | 61 |
| 12 hex scalars (each) | 25 | 18 to 27 | 16 to 22 | 16 to 22 | -9 to -19% | -9 to -19% | 54 to 582 | 54 to 516 |

The calldata effect repeats from the six-method run: `eth_getTransactionByHash` barely moves at T1
(-7.4%) and then collapses at T2 (-69.0%). The ABI decode of the `input` blob is where that
method's tokens live.

## Latency (warm connections, per-method p50 over 25 samples)

Same-connection Node `fetch` (keep-alive): T2 is at parity or faster on every method except the
single heaviest one. `eth_getBlockReceipts` costs +16 ms at p50 on a roughly 1.5 MB body, which is
where the transform cost becomes visible because transfer is nearly free on a warm socket.
Cold-connection measurements taken the same day (fresh TLS per request, 12-sample `curl` runs)
favour T2 outright: receipt 300 to 220 ms p50, block receipts 1,018 to 618 ms, with the body
dropping from 821 KB to 316 KB on the wire. Net effect: the server-side decode does not tax the
read path, and on cold paths the smaller transfer wins.

## Setup notes

- Block selection: 25 random blocks in `[head - 1,000,000, head]` chosen by a deterministic LCG
  seeded with 42. Per block the script picks a random tx hash from that block and a random popular
  ERC-20 (USDC, DAI, USDT, WETH) for the 3-block `Transfer`-topic `eth_getLogs` window.
- Empty-`getLogs` and null-uncle triples are dropped before tokenization. Caveat worth stating
  plainly: uniform-shape logs skew savings higher than a topic-less query would, the same caveat
  that applied to the earlier six-method run.
- Tiers are requested via canonical `Accept-Token-Tier: 1|2`; tier 0 means no header at all. The
  applied tier is confirmed from the `Token-Tier` response echo on every single call, never assumed.
- Token counts include the JSON-RPC envelope (`jsonrpc`, `id`, `result`), because that is what an
  LLM consumer actually pays for.
- These numbers describe the deployment as measured on 2026-07-17. Coverage and per-method rules
  change over time, so re-run the probe before quoting them.

## Reproduce

```bash
cd bench
pnpm install
ANKR_RPC_KEY=<your-key> node scripts/live-token-savings.mjs

# or point it at any other TORPC endpoint, key included in the URL:
ANKR_RPC_URL=https://<host>/<path>/<key> node scripts/live-token-savings.mjs
```

The script prints the coverage probe, one line per iteration, the per-method table and the overall
token-weighted and unweighted reductions. Absolute token counts will differ from the table above
because the blocks are drawn relative to the current chain head, but the reduction percentages
should land in the same range.
