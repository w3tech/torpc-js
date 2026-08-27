# Changelog

Notable changes to the TORPC reference implementation: the codec published as
[`@w3tech.io/torpc-decoder`](https://www.npmjs.com/package/@w3tech.io/torpc-decoder), the transform
rule library under [`packages/torpc-toevm-rules/`](./packages/torpc-toevm-rules/), and the benchmark
harness under [`bench/`](./bench/).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version headings are
npm releases of the codec, the only published package here, dated to the day that version was
published. Repository changes that no release carries yet sit under Unreleased. The specification
this code implements versions separately, in [w3tech/torpc](https://github.com/w3tech/torpc).

## Unreleased

### Changed

- The decoder publish workflow authenticates with npm trusted publishing over OIDC and requests
  provenance, so releases after 0.1.0 carry a provenance attestation. 0.1.0 was published before
  this landed and carries none.

## [0.1.0] - 2026-08-25

First npm release of the reference codec, `@w3tech.io/torpc-decoder`, under Apache-2.0. Its
normative reference is EVM RPC Compression v1 (Draft) in the specification repository.

### Added

- Bidirectional mapper between standard EVM JSON-RPC responses and the TORPC compact form:
  `forward(method, response)` and `backward(method, response)`. Structural only — it reshapes what
  it is given and resolves no ABIs, so producing decoded `{event, args}` and `{function, args}`
  shapes remains the server's job. Forward renames fields, converts hex to decimal, strips padding
  from indexed topics, drops the service fields and applies EIP-55; where a log or transaction
  already carries provider-decoded fields it collapses to the decoded shape.
- Coverage of 23 methods across 8 mappers: the hex-integer group, transaction and receipt, logs,
  block, uncle, block receipts and fee history.
- A conformance adapter, [`codec/scripts/conformance-adapter.ts`](./codec/scripts/conformance-adapter.ts),
  which drives the specification repository's golden vectors against this mapper. The published
  suite is a single-case scaffold, so a green run means "this case holds", not conformance.
- The package ships built JavaScript with type declarations rather than the TypeScript in
  `codec/src`: Node does not strip types inside `node_modules`, so a `.ts` entry point cannot be
  imported. Inside a checkout the sources are still imported directly, with no build step.
- CI across the workspace — typecheck, tests, lint and the publishable build — and a dispatch-only
  publish workflow that installs the packed tarball into a throwaway project and imports it before
  anything is released.

## 2026-08-13

### Added

- Repository published, Apache-2.0 throughout, as one pnpm workspace with one lockfile:
  [`codec/`](./codec/) (the mapper), [`packages/torpc-toevm-rules/`](./packages/torpc-toevm-rules/)
  (the individual transform rules the mapper composes: hex stripping, hex to decimal, service-field
  dropping), and [`bench/`](./bench/) (the benchmark harness).
- The benchmark harness and its results: token efficiency and retrieval accuracy over captured
  Ethereum mainnet responses rather than synthetic data, with the methodology and the known
  measurement limits in [`bench/README.md`](./bench/README.md).
- The published live run,
  [`bench/results/live-token-savings-2026-07-17.md`](./bench/results/live-token-savings-2026-07-17.md):
  21 methods across 25 Ethereum mainnet blocks against a live endpoint, counted with `o200k_base`
  over the full HTTP response body. Token-weighted reduction against raw is 35.3% at T1 and 48.4%
  at T2, with per-method figures in the document.
