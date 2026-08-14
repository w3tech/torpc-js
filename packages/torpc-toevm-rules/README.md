# @torpc/toevm-rules

Field-level transformation primitives for **TORPC (Token Optimized RPC)** on EVM chains: the named
transforms that a compressing server applies to a raw Ethereum JSON-RPC response.

Normative reference, in the spec repository [w3tech/torpc](https://github.com/w3tech/torpc):

- [`specs/evm-v1.md`](https://github.com/w3tech/torpc/blob/main/specs/evm-v1.md), the tier
  mechanism and the T1 / T2 primitives
- [`specs/methods/`](https://github.com/w3tech/torpc/tree/main/specs/methods), the per-method
  field mappings and worked examples

Target specification revision: **EVM RPC Compression v1**, exported as `TARGET_SPEC` (`'evm-v1'`).

## Read this before you build on it

**This package is a partial reference of the T1 primitives, not a complete implementation of the
spec.** Three primitives are implemented: `hex_strip`, `hex_to_dec`, `drop_service`. They are
individually spec-conformant. Composing them does **not** produce conformant T1 output, because the
rest of a per-method mapping is missing: the field renames, the `status` boolean rename, EIP-55
casing, the hoist of fields shared by every log entry, and the per-method drop of `contractAddress`
when it is `null`. Nothing here implements T2, tier negotiation, the `Accept-Token-Tier` /
`Token-Tier` headers, or method dispatch.

If you want a complete, conformance-tested implementation of the spec, use
[`@w3tech.io/torpc-decoder`](https://www.npmjs.com/package/@w3tech.io/torpc-decoder) (`codec/` in that repository), which maps
whole responses per method in both directions and runs against the conformance vectors. This package
exists so the individual primitives can be named, read and reused in isolation.

## What it is

Pure functions. No I/O, no global state, deterministic for a given input, **no runtime
dependencies**, so a rule can run inside an HTTP proxy, an MCP server, a test or a benchmark
harness.

Design constraints:

- **Spec driven.** Rule names, semantics and outputs follow the spec text, not the other way round.
- **Pure.** A rule takes a value and returns a value.
- **Composable.** A method mapping is a sequence of rules.
- **Embeddable.** No framework, no dependencies.

## Rule catalogue

Rule IDs are the `RuleId` union exported from `src/types.ts`. Only the first three have code behind
them; the rest of the union names the work, it does not do it.

| Rule ID | Spec reference | Status |
|---|---|---|
| `hex_strip` | `evm-v1.md` §T1, structural zero-block strip on 32-byte hex values | implemented, both the exactly-24 and the exactly-12 zero-byte cases |
| `hex_to_dec` | `evm-v1.md` §T1, hex-to-decimal numeric encoding, decimal string at every magnitude | implemented |
| `drop_service` | `evm-v1.md` §T1 plus the per-method drop lists | implemented for the `eth_getTransactionReceipt` shape |
| `hoist_shared` | `evm-v1.md` §T1, hoist fields shared by every log entry | not implemented, required by v1 |
| `eip55` | `evm-v1.md` §T1, EIP-55 casing on dedicated address-typed fields | not implemented, required by v1 |
| `compact_names` | field renames are specified per method, not as one global rule | not implemented, no global definition to implement |
| `topic_decode` | `evm-v1.md` §T2, decoded event as `{event, args}` | not implemented |
| `calldata_decode` | `evm-v1.md` §T2, decoded calldata as `{function, args}` | not implemented |
| `wei_to_native` | not normative in v1: no per-method mapping converts wei to a native-unit string | name only, on hold |
| `aggregate_same_event` | array sub-variants (`+aggregate`) are deferred by the spec to v1.1+ | name only, on hold |
| `address_label` | not normative in v1: labels are an enrichment, not a required shape | name only, on hold |
| `action_classify` | action classification sits in the reserved tier range (3 and above) and has no normative definition in v1 | name only, on hold |

Anything marked "on hold" is a leftover of an earlier draft that the current spec does not make
normative. The IDs stay in the union for compatibility, but do not build against them expecting
spec-mandated behaviour, and do not expect a type describing their output: for the reserved tiers the
spec defines none.

### Notes on the implemented three

- `drop_service` **keeps** the receipt-level `transactionIndex`. The spec renames it to `tx_index`
  and keeps it, because a transaction's position in consensus history is not reconstructible from
  the other fields. Dropping it would fail the conformance vector
  `eth_getTransactionReceipt/hex-strip-and-drop-service`. Performing the rename is out of this
  rule's scope, so the field comes out of `dropServiceFields` under its raw name and raw hex value.
- `hex_strip` emits lowercase and carries no type claim, so EIP-55 casing MUST NOT be applied to its
  output. An all-zero 32-byte value has 32 leading zero bytes, which is neither the exactly-24 nor
  the exactly-12 case, so it passes through verbatim.
- `hex_to_dec` returns a decimal string at every magnitude. Malformed input passes through unchanged
  per the transformation-failure passthrough rule in `evm-v1.md` §Behavior.

## What the spec does not fix

The spec defines *what* T2 output must look like. It deliberately says nothing about how a server
obtains its decoding. Implementations are free to differ on:

- the function and event signature source
- the ABI cache and its backend
- any known-contract or token registry
- whether decoded amounts are enriched at all

Different implementations using different sources must still produce the same output shape on the
canonical fixtures. That is what the conformance suite in the spec repository checks. A difference
on a case the suite does not cover is implementation freedom, and the right response is a spec
clarification, not a bug report.

The spec also defines no way for a server to advertise which of those sources it used: there is no
provenance header and no in-body provenance field in v1. Anything a rule receives through
`RuleContext` is an implementation detail of the caller.

## Usage

```typescript
import { hexStrip, hexToDec, dropServiceFields, TARGET_SPEC } from '@torpc/toevm-rules';

const raw = await provider.send('eth_getTransactionReceipt', [hash]);

// Each call below is one spec primitive applied to the fields it names.
// This is NOT conformant T1 output: the renames, the status rename and EIP-55
// casing are missing. See "Read this before you build on it".
const dropped = dropServiceFields(raw);
const block = hexToDec(raw.blockNumber);            // "25093593"
const topics = raw.logs[0].topics.map((t, i) => (i === 0 ? t : hexStrip(t)));
```

`topics[0]` is kept verbatim: it is the event-signature hash, not a padded value.

A `composeRules` entry point that applies a full per-method mapping in one call is not part of this
package and is not planned here, because `@w3tech.io/torpc-decoder` already does that job.

## Development

Requires Node 22.6 or newer. No runtime dependencies, so any package manager works.

```bash
npm install
npm test           # node --test
npm run typecheck  # tsc --noEmit
```

No compile step: `.ts` files run directly under Node's type stripping.

## Licence

**Apache-2.0.** See [LICENSE](LICENSE). Copyright Web3 Technologies, Inc. (dba Ankr).

The specification this library implements is published separately under CC0 1.0, together with the
conformance suite, in [w3tech/torpc](https://github.com/w3tech/torpc). Implementing the spec
requires no licence from anyone; this particular implementation is Apache-2.0 so that contributors
get an explicit patent grant and a clear provenance trail.
