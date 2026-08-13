# TORPC reference implementation

Reference code for **TORPC (Token Optimized RPC)**, an opt-in compression scheme for blockchain
JSON-RPC responses aimed at LLM agents: hex becomes decimal, service fields are dropped, and
contract calls and event logs are carried in a decoded `{function, args}` / `{event, args}` shape.
The point is fewer tokens for the same answer.

**The specification lives in a separate repository**,
[w3tech/torpc](https://github.com/w3tech/torpc), released under CC0 1.0 Universal. That is the
normative document. This repository is one implementation of it, and where the two disagree the
spec wins.

## What is in here

| Path | Package | What it is |
| ---- | ------- | ---------- |
| [`codec/`](./codec/README.md) | `@torpc/decoder` | Bidirectional mapper between standard EVM JSON-RPC responses and the TORPC compact form. Structural only: it reshapes what it is given and does not resolve ABIs. |
| [`packages/torpc-toevm-rules/`](./packages/torpc-toevm-rules/README.md) | `@torpc/toevm-rules` | The individual transform rules the mapper composes: hex stripping, hex to decimal, service-field dropping. |
| [`bench/`](./bench/README.md) | not a package | The benchmark harness: how many tokens the transform actually saves, and whether a model can still answer questions from the compressed payload. Measured on captured Ethereum mainnet responses, not on synthetic data. |

## Status

**Neither package is on npm yet.** Both are marked `private` in their `package.json`, and the names
above are what they will carry rather than something you can install today. Use them from a checkout,
importing the TypeScript sources directly.

## Running it

Node 24 or newer. No build step: the sources are imported as TypeScript.

```sh
cd codec                        && node --test          # the mapper
cd packages/torpc-toevm-rules   && npm test             # the rules
cd bench                        && cat README.md        # the harness has its own instructions
```

`npm run typecheck` in `codec/` and `packages/torpc-toevm-rules/` runs `tsc --noEmit`.

## Conformance

The spec repository carries the conformance vectors and a dependency-free runner. This repository
supplies the adapter that drives them against the mapper here, at
[`codec/scripts/conformance-adapter.ts`](./codec/scripts/conformance-adapter.ts). Running the
published vectors against this implementation is what keeps the two honest about each other, so a
change here that breaks a vector is a bug in this repository until proven otherwise.

The suite is a scaffold rather than broad coverage today, and the spec repository says so where it
documents it. Treat a green run as "this case holds", not as "the implementation is complete".

## Contributing

The specification and the implementation move at different speeds and under different licences, so
they take changes differently:

- A change to what TORPC **means** belongs in
  [w3tech/torpc](https://github.com/w3tech/torpc): a spec edit, a decision entry, and usually a
  conformance vector.
- A change to how this code **implements** it belongs here, with a test.

If you are not sure which one you have, open it here and say so; moving it is easy.

## Licence

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

The specification is published separately under CC0 1.0 Universal, so implementing TORPC needs no
permission from us. TORPC is a trademark of Web3 Technologies, Inc. (dba Ankr); the licences here
grant no trademark rights.
