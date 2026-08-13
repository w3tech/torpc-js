# Raw-baseline cross-check, 2026-07-27

Every saving figure in this project is a percentage **of our own raw output**. That makes the
baseline load-bearing: if our untransformed responses were larger than everyone else's, every
reduction downstream would be flattered by the difference. This is the control for that.

| | |
|---|---|
| **What is compared** | our tier-0 (no opt-in header) against an independent major provider's Ethereum mainnet endpoint, same method and params, same moment |
| **Tokenizer** | `o200k_base` (`gpt-tokenizer`), counted over the full HTTP response body |
| **Script** | [`../scripts/raw-baseline-crosscheck.mjs`](../scripts/raw-baseline-crosscheck.mjs) |
| **Both sides** | plain JSON-RPC, untransformed. Neither side is running TORPC. |

This is not a comparison of providers and it is not a benchmark. It answers one question: is our
raw response the same size as anyone else's raw response?

## Result

| Call | Our tokens | Independent endpoint | Delta |
|---|---:|---:|---:|
| `eth_getTransactionByHash` | 536 | 524 | +2.29% |
| `eth_getTransactionReceipt` | 696 | 696 | 0 |
| `eth_getBlockByNumber` (hashes only) | 14,703 | 14,703 | 0 |
| `eth_getBlockByNumber` (full transactions) | 213,176 | 209,228 | +1.89% |
| `eth_getBlockReceipts` | 510,690 | 510,690 | 0 |
| `eth_getLogs` (1 block, 1 address) | 28,222 | 28,222 | 0 |
| `eth_blockNumber` | 20 | 20 | 0 |
| **Total** | **768,043** | **764,083** | **+0.52%** |

Four of the seven responses are byte-identical between the two endpoints, including the two
largest. Bytes track tokens closely: +0.57% on bytes against +0.52% on tokens.

## Where the difference comes from, and which way it cuts

The whole delta sits in transaction objects, and it has one cause: **our nodes include
`blockTimestamp` on a transaction, and the other endpoint does not.** Field sets are otherwise
identical, verified by comparing the key sets directly. A single transaction is 2.29% larger for
that one field, and a block rendered with full transaction objects carries the same field 241 times,
which is the 1.89% on that row.

Two honest consequences:

- The `eth_getLogs` row is the same size on both endpoints but not byte-identical, because log
  ordering and field ordering are not fixed by JSON-RPC. Size claims survive that; byte-for-byte
  claims would not, which is one reason the spec scopes cross-server equivalence to structural
  equivalence rather than byte identity.
- `blockTimestamp` is a field the tier-1 rules **drop**. So quoting a saving against our own raw is
  very slightly generous on transaction-shaped payloads: part of what tier 1 removes is a field a
  different node would not have sent in the first place. The size of that effect is the number in
  the table, under 1% aggregate and about 2% on transaction objects, which is small next to the
  reductions being reported (-35.3% at tier 1, -48.4% at tier 2 on the live run) but it is real and
  it is in our favour, so it belongs in writing.

The direction that would have been a problem is the other one: a raw baseline inflated by something
we add and then remove. There is no sign of that. The one field responsible is emitted by the node,
not by the transform layer, and everything else matches.

## Reproducing it

```bash
cd bench
pnpm install
export ANKR_RPC_URL='https://rpc.ankr.com/eth/YOUR_ANKR_API_KEY'
export OTHER_RPC_URL='https://<any-independent-ethereum-mainnet-endpoint>'
node scripts/raw-baseline-crosscheck.mjs
```

Any independent endpoint works, including your own node: the point is that a second implementation
of the same JSON-RPC returns the same thing at the same size. Absolute token counts move with the
pinned block and with node client versions; the deltas are what this measures.

The provider used for the run above is not named here on purpose. Nothing in this document is a
claim about a competitor, and naming one would invite reading it as such.
