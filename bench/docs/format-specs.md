# Format specifications (first-generation harness)

Exact wire-level shapes of the four format adapters of the **first-generation** harness, kept so
that the 2026-05 runs stay auditable.

> **Not the TORPC specification.** The envelope described below, referred to as AEP, was a local
> encoder design that predates the TORPC tier model and was replaced by it. The normative TORPC
> format is `specs/evm-v1.md` in [w3tech/torpc](https://github.com/w3tech/torpc), and the current
> harness captures `raw` / `T1` / `T2` from a live endpoint instead of encoding anything locally:
> see [`../README.md`](../README.md). Nothing on this page is normative, and the `Content-Type`
> values, the `raw_pointer` field and the `finality` field below exist in no shipped TORPC tier.

## 1. `raw_rpc`

Standard [JSON-RPC 2.0](https://www.jsonrpc.org/specification) envelope around the
node's `result` field, pretty-printed with 2-space indent:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... raw RPC reply, untouched ... }
}
```

- `Content-Type: application/json`
- This is what any standard JSON-RPC node returns today, with no compression opt-in.
- Source: `src/formats/raw-rpc.ts`

## 2. `raw_rpc_toon`

The same envelope from `raw_rpc`, encoded with [TOON](https://toonformat.dev) v2.

TOON is a token-oriented variant of YAML/JSON designed for LLM prompts. Key
properties:

- Schema-aware tabular encoding for homogeneous arrays — replaces repeated
  key names with a header row, drastically reduces tokens for list-heavy payloads.
- Quoting is minimal — strings are bare unless they contain delimiters.
- No structural punctuation noise (`{}`, `[]`, `,`).
- Pure transformation: parses back to identical JSON.

Applied to the whole envelope, not just internal arrays. This is the **coarser**
variant of TOON integration — the spec also describes an "arrays-only" mode
(`docs/methodology.md` §3 footnote) which has not yet been implemented.

- `Content-Type: application/toon`
- Source: `src/formats/raw-rpc-toon.ts`
- Library: [`@toon-format/toon@2.x`](https://www.npmjs.com/package/@toon-format/toon)

## 3. `compressed_v1` — Ankr Agent Envelope Protocol (AEP)

Semantic envelope with information that raw JSON-RPC structurally lacks. Encoded as
pretty-printed JSON with 2-space indent. The encoder dispatches to one of nine
per-method compressors:

```
eth_getTransactionReceipt    → compressReceipt
eth_getTransactionByHash     → compressTransaction
eth_getBlockByNumber         → compressBlock
eth_getLogs                  → compressLogs
eth_getBalance               → compressBalance
eth_getTransactionCount      → compressTransactionCount
ankr_getAccountBalance       → compressAccountBalance
ankr_getTokenTransfers       → compressTokenTransfers
ankr_getNFTsByOwner          → compressNFTs
```

- `Content-Type: application/vnd.ankr.compressed+json;v=1`
- Source: `src/formats/compressed-v1/{index,methods,rules}.ts`

### 3.1 Envelope fields

All compressed methods share these conventions:

| Field | Type | Meaning |
|---|---|---|
| `finality` | `"confirmed"` \| `"safe"` \| `"latest"` | Reorg risk classification at capture time |
| `as_of_block` | `int` | Block number the data is anchored to |
| `raw_pointer` | URL string | `ankr://...` pointer to the unmodified raw response (for agents that need to drill in) |
| `truncated` | `bool` | Whether the response is partial (e.g. paginated API hit a page cap) |
| `cursor` | string \| null | Continuation token if `truncated:true` |

### 3.2 Per-method shapes

**`compressReceipt`** — `eth_getTransactionReceipt`:

```json
{
  "tx": "0x...",
  "block": 21540854,
  "from": "0x...",
  "to": "0x... | null",
  "status": "success | failed",
  "fee": { "gas": 164090, "gas_price_gwei": 2 },
  "log_count": 6,
  "action": { "type": "transfer | swap | approve | mint | burn | contract_deployment | failed | other", "...details..." },
  "finality": "confirmed",
  "raw_pointer": "ankr://rpc/eth/receipt/0x..."
}
```

- `action.type` is computed from event topics (`Transfer`/`Approval`/`Swap` signatures)
  and contract-deployment heuristics (`to == null`). This is the field that drives
  `semantic` category accuracy.

**`compressTransaction`** — `eth_getTransactionByHash`:

```json
{
  "tx": "0x...",
  "block": 21540854,
  "from": "0x...",
  "to": "0x... | null",
  "value": "0.5 ETH",
  "nonce": 142,
  "input_size_bytes": 244,
  "finality": "confirmed",
  "raw_pointer": "ankr://rpc/eth/tx/0x..."
}
```

**`compressBlock`** — `eth_getBlockByNumber`:

```json
{
  "block": 21540854,
  "hash": "0x...",
  "parent": "0x...",
  "time": "2025-01-08T15:23:11.000Z",
  "tx_count": 162,
  "gas_used": 14958877,
  "gas_limit": 30000000,
  "utilisation_pct": 49.86,
  "finality": "confirmed",
  "raw_pointer": "ankr://rpc/eth/block/21540854"
}
```

**`compressLogs`** — `eth_getLogs`:

```json
{
  "total": 816,
  "range": { "from_block": 21540805, "to_block": 21540854 },
  "by_event": [
    { "contract": "USDC", "event": "Transfer", "count": 816, "total_raw": "12345...678" }
  ],
  "samples": [ /* first 3 logs, raw-ish */ ],
  "finality": "confirmed",
  "raw_pointer": "ankr://rpc/eth/logs?range=21540805-21540854"
}
```

This is where the largest token win lives. A raw `eth_getLogs` for 800 events is
~100K tokens; the compressed summary is ~150 tokens, and the canonical aggregations
(`total`, `count`, `total_raw`) are exactly what aggregation questions ask for.

**`compressBalance`** — `eth_getBalance`:

```json
{ "balance": "0.5 ETH", "as_of_block": 21540854, "finality": "confirmed" }
```

**`compressTransactionCount`** — `eth_getTransactionCount`:

```json
{ "nonce": 142, "as_of_block": 21540854 }
```

**`compressAccountBalance`** — `ankr_getAccountBalance`:

```json
{
  "holdings": [
    { "asset": "USDT", "amount": "369643884.55", "usd": "369643884.55" },
    { "asset": "ETH",  "amount": "53753.96",     "usd": "..." }
  ],
  "total_usd": "912832508.26",
  "finality": "confirmed",
  "raw_pointer": "ankr://aapi/account-balance"
}
```

**`compressTokenTransfers`** — `ankr_getTokenTransfers`:

```json
{
  "total": 100,
  "truncated": true,
  "summary": {
    "tokens_seen": [ { "symbol": "USDT", "transfers": 87, "total": 4.2e10 } ],
    "counterparties_unique": 38
  },
  "top": [ /* top-3 transfers by value */ ],
  "cursor": "...nextPageToken...",
  "finality": "confirmed",
  "raw_pointer": "ankr://aapi/transfers"
}
```

**`compressNFTs`** — `ankr_getNFTsByOwner`:

```json
{
  "total": 50,
  "truncated": true,
  "collections": [
    { "name": "AzuLadys", "contract": "0x...", "count": 50, "standard": "ERC721" }
  ],
  "cursor": "...nextPageToken...",
  "raw_pointer": "ankr://aapi/nfts"
}
```

### 3.3 Fallback for unknown methods

If a method is captured for which there is no compressor, the encoder returns a
plain JSON-RPC envelope (`{ jsonrpc, id, result }`). This is deliberate — it gives
us a fair raw-RPC-equivalent measurement and keeps Phase 1 numerics honest.

## 4. `compressed_v1_toon`

The AEP envelope (output of `compressed_v1`'s per-method compressor) re-encoded as
TOON. `Content-Type: application/vnd.ankr.compressed+toon;v=1`. Source:
`src/formats/compressed-v1-toon.ts`.

Same library as `raw_rpc_toon` (`@toon-format/toon@2.x`).

## 5. Why TOON is applied to the whole envelope, not just internal arrays

The benchmark spec (§5.4) describes a more conservative TOON integration: apply
TOON only to homogeneous arrays inside the AEP envelope, leave scalars and
heterogeneous nested objects as JSON. That mode preserves the JSON envelope's
familiarity while still capturing the array-encoding win.

In this implementation we apply TOON to **the entire payload** (both for `raw_rpc`
and `compressed_v1`). Why:

- It is the **harder test** — if AEP is already tight, whole-payload TOON may
  not buy us much extra; if there is headroom, we'll see it.
- It is the **cleanest 4-way comparison** — both serialisation deltas
  (`raw_rpc` → `raw_rpc_toon`, `compressed_v1` → `compressed_v1_toon`) are
  apples-to-apples, no partial-TOON / full-TOON ambiguity.
- It is the **simplest to implement** — one library call, no schema introspection.

The "arrays-only" mode is on the roadmap; numbers from there will go on top of
this 4-way matrix, not replace it.

## 6. Content-Type negotiation (informational)

When AEP ships as a production protocol, clients will negotiate the format via
`Accept` headers:

| Accept | Server returns |
|---|---|
| `application/json` (default) | `raw_rpc` |
| `application/vnd.ankr.compressed+json;v=1` | `compressed_v1` |
| `application/toon` | `raw_rpc_toon` (envelope as TOON) |
| `application/vnd.ankr.compressed+toon;v=1` | `compressed_v1_toon` |

This was the format-negotiation slot in the AEP design, with the server echoing the matched format
in `Content-Type`. TORPC took a different route: one request header carrying a tier hint
(`Accept-Token-Tier`) and one response header stating the tier applied (`Token-Tier`), with the
media type left alone.

## 7. Versioning

`compressed_v1` versions live in the `v=1` MIME parameter. A future `v=2` is
expected to bring (some of) these:

- Inlined ERC-20 token decimals so amounts are pre-converted to human units
- Action-type extensions for L2-specific patterns (rollup deposits, bridges)
- Per-tx provenance with `finality.epoch_distance` instead of just enum
- Optional `compression_stats.savings_pct` self-reported by the server

TOON version (`@toon-format/toon`) follows upstream semver — currently `2.x`.
