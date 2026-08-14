# @w3tech.io/torpc-decoder

Reference **bidirectional mapper** between standard EVM JSON-RPC responses and the
**TORPC (Token Optimized RPC)** compact form. Structural only: **no ABI resolution, no decoding of
raw calldata or logs, no re-encoding.** Producing the decoded `{event, args}` / `{function, args}`
shapes is the server's job (spec tier T2). This library only reshapes what it is given.

```
npm install @w3tech.io/torpc-decoder
```

```ts
import { forward, backward } from '@w3tech.io/torpc-decoder';
```

The published package is built JavaScript with type declarations, not the TypeScript in `src`: Node
does not strip types inside `node_modules`, so a `.ts` entry point cannot be imported. Inside a
checkout the sources are imported directly, no build step needed.

```ts
import { forward, backward } from './src/index.ts';

const raw = { jsonrpc: '2.0', id: 1, result: '0x180fcbd' };
forward('eth_blockNumber', raw);   // → { jsonrpc, id, result: '25230525' }
backward('eth_blockNumber', { jsonrpc: '2.0', id: 1, result: '25230525' });
                                   // → { jsonrpc, id, result: '0x180fcbd' }
```

Normative reference, in the spec repository [w3tech/torpc](https://github.com/w3tech/torpc):
[`specs/evm-v1.md`](https://github.com/w3tech/torpc/blob/main/specs/evm-v1.md) for the tier
mechanism and the T1 / T2 rules, and
[`specs/methods/`](https://github.com/w3tech/torpc/tree/main/specs/methods) for the per-field
mapping of each method. Those documents are the source of truth; this library is one
implementation of them.

## How it works

- **forward** (standard to compact): rename, hex to decimal, strip padding from indexed topics,
  drop service fields, apply EIP-55. If a log or transaction already carries provider-decoded
  fields (`event` / `args` / `function`), collapse it: keep the decoded shape, drop the now
  redundant raw `topics` / `data` / `input`.
- **backward** (compact to standard): the mechanical inverse. Inverse renames, decimal to hex,
  re-pad topics, lowercase addresses.

Backward reverses only the mechanical mapping. A log or transaction that was
decoded-and-collapsed on the way forward loses its raw `topics` / `data` / `input` permanently;
backward returns the decoded fields plus the reversed structural fields. **Lossy by design**:
`logsBloom`, `cumulativeGasUsed`, `type`, `chainId`, the signature fields `v` / `r` / `s` /
`yParity`, and per-log redundant or service fields are dropped at T1 by the spec and are not
restored. Clients that need them re-issue the request with no `Accept-Token-Tier` header and read
the raw response.

## Three levels

1. **primitives** (`src/primitives/`): `hexToDec` / `decToHex`, `stripZeroBlock` / `padZeroBlock`,
   `eip55` / `lower`, `rename` / `drop`, and the `Field` table engine that drives both directions
   from a single declaration.
2. **per-method** (`src/methods/`): one module per method, wired into `methods` and then the
   `registry`. Unknown method means passthrough.
3. **batch** (`src/dispatch.ts`): `forwardBatch` / `backwardBatch`. The caller supplies the method
   per element, because a JSON-RPC response does not carry one.

## Method coverage

Every v1 method that has an entry under `specs/methods/` in the spec repository:

| Module | Methods |
|---|---|
| `hexInteger` | `eth_blockNumber`, `eth_chainId`, `eth_gasPrice`, `eth_maxPriorityFeePerGas`, `eth_blobBaseFee`, `eth_getBalance`, `eth_getTransactionCount`, `eth_estimateGas`, `eth_getBlockTransactionCountBy{Hash,Number}`, `eth_getUncleCountByBlock{Hash,Number}` |
| `transactionReceipt` | `eth_getTransactionReceipt` |
| `getLogs` | `eth_getLogs` |
| `transactionByHash` | `eth_getTransactionByHash`, `eth_getTransactionByBlock{Hash,Number}AndIndex` |
| `getBlockByHash` | `eth_getBlockByHash`, `eth_getBlockByNumber` |
| `blockReceipts` | `eth_getBlockReceipts` |
| `uncle` | `eth_getUncleByBlock{Hash,Number}AndIndex` |
| `feeHistory` | `eth_feeHistory` |

Any method not listed passes through untouched, which matches the spec: a method with no ruleset
must be returned raw at `Token-Tier: 0`.

## Development

Requires Node 22.6 or newer (native TS type stripping, no build step in dev).

```bash
npm install
npm test          # node --test
npm run typecheck # tsc --noEmit
```

Only runtime dependency: `@noble/hashes`, for keccak256 in EIP-55.

## Licence

**Apache-2.0.** Copyright Web3 Technologies, Inc. (dba Ankr). Every file in this package is under
that licence, and the full text is the `LICENSE` file at the root of
[w3tech/torpc-js](https://github.com/w3tech/torpc-js).

The TORPC specification itself is published separately under CC0 1.0 in
[w3tech/torpc](https://github.com/w3tech/torpc). CC0 waives the copyright in the specification text,
which is what lets anyone reimplement the spec without permission or attribution. It is a copyright
waiver and nothing more: it grants no patent rights and no trademark rights. For this code, the
patent position is the express grant in Apache-2.0 §3, which is one reason the implementation is
Apache-2.0 rather than CC0; the other is the contribution trail.
