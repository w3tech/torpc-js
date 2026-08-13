/**
 * Public types for the TORPC (Token Optimized RPC) EVM rules library.
 *
 * Normative reference: `specs/evm-v1.md` (the tier mechanism and the T1 / T2
 * primitives) plus `specs/methods/` (the per-method field mappings). Type names
 * below mirror spec field names where reasonable, for example `RawReceipt` for
 * the raw `eth_getTransactionReceipt` response shape and `CompressedReceipt`
 * for its T1 / T2 form.
 *
 * Only T1 and T2 are normative in v1. Tiers 3 and above are reserved and have
 * no defined output shape, so no type here describes one.
 */

/**
 * Stable identifier of a rule in this package's rule catalogue.
 *
 * Not every identifier is backed by an implementation, and not every one is
 * backed by normative spec text. See README.md "Rule catalogue" for the status
 * of each, and `specs/evm-v1.md` §T1 / §T2 for the primitives the spec does
 * define.
 */
export type RuleId =
  | 'hex_strip'
  | 'hex_to_dec'
  | 'drop_service'
  | 'topic_decode'
  | 'calldata_decode'
  | 'hoist_shared'
  | 'eip55'
  | 'compact_names'
  | 'wei_to_native'
  | 'aggregate_same_event'
  | 'address_label'
  | 'action_classify';

/**
 * A rule is a pure function from input payload to output payload.
 *
 * Rules MUST be deterministic: the same input yields the same output. The
 * determinism requirement in `specs/evm-v1.md` §Behavior (rule 6), which is
 * what makes shared LLM prompt caching work, depends on this.
 *
 * Rules MAY consume context (chain id, a signature or ABI source). Context is
 * implementation-specific: `specs/evm-v1.md` §T2 puts the sourcing of a
 * decoding explicitly out of scope, and the spec defines no way to declare it
 * on the wire.
 */
export type Rule<TIn = unknown, TOut = unknown, TCtx = RuleContext> = (
  input: TIn,
  ctx?: TCtx,
) => TOut;

/**
 * Implementation-specific context passed to rules. The spec mandates none of
 * these and defines no response header or in-body field that advertises them.
 */
export interface RuleContext {
  /** Chain id (e.g. 1 for Ethereum mainnet, 137 for Polygon). */
  chainId?: number;

  /** Optional ABI lookup. Returns the ABI for a given contract address if known. */
  abiLookup?: (address: string) => Promise<unknown | null>;

  /** Optional 4byte signature lookup (event topic[0] or function selector to signature string). */
  fourByteLookup?: (selector: string) => Promise<string | null>;
}

/**
 * Raw `eth_getTransactionReceipt` response shape, limited to the fields the v1
 * mapping enumerates. Unenumerated fields, including chain-specific extensions
 * such as Optimism `l1Fee*`, are permitted and pass through verbatim at every
 * tier (`specs/evm-v1.md` §T1, unknown-field passthrough).
 */
export interface RawReceipt {
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  transactionIndex: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  gasUsed: string;
  logs: RawLog[];
  logsBloom: string;
  status: string;
  type: string;
  [key: string]: unknown;
}

export interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockHash: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
  removed: boolean;
  /** EIP-7642, present on some clients. Dropped at T1. */
  blockTimestamp?: string;
  [key: string]: unknown;
}

/**
 * Compressed receipt per `specs/methods/eth_getTransactionReceipt.md` §2 (T1)
 * and §3 (T2). The receipt-level field set is identical at both tiers, only the
 * per-log shape changes. This object is the value of the JSON-RPC `result`
 * field: v1 adds no envelope.
 *
 * Every hex-decoded numeric is a decimal string at every magnitude
 * (`specs/evm-v1.md` §T1, hex-to-decimal numeric encoding). None of them is a
 * JSON number.
 */
export interface CompressedReceipt {
  /** From `transactionHash`. */
  tx: string;
  /** From `transactionIndex`, decimal string. */
  tx_index: string;
  /** From `blockNumber`, decimal string. */
  block: string;
  /** From `blockHash`. Required: `block` alone does not identify a block across forks. */
  block_hash: string;
  from: string;
  /** `null` on contract creation. */
  to: string | null;
  /** Omitted when the raw value is `null`. */
  contractAddress?: string;
  /** From `status`: `"0x1"` to `"success"`, `"0x0"` to `"failed"`. */
  status: 'success' | 'failed';
  /** From `gasUsed`, decimal string. */
  gas_used: string;
  /** From `effectiveGasPrice`, decimal string. */
  gas_price: string;
  logs: CompressedLog[];
  /** Chain-specific extension fields pass through verbatim. */
  [key: string]: unknown;
}

/** A log entry at T1: dropped service fields, stripped indexed topics. */
export interface CompressedLogT1 {
  address: string;
  /** `topics[0]` verbatim, `topics[1..N]` after the structural zero-block strip. */
  topics: string[];
  data: string;
  /** Present only when the raw log carried `removed: true`. */
  removed?: true;
  [key: string]: unknown;
}

/** A log entry at T2: the decoded event shape. */
export interface CompressedLogT2 {
  /** From `address`, renamed at T2. */
  contract: string;
  /** Event signature name resolved from `topics[0]`. */
  event: string;
  /** Decoded parameters, keyed by ABI parameter name, in ABI parameter order. */
  args: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * A log entry whose ABI could not be resolved at T2: kept in its T1 form and
 * tagged in band (`specs/evm-v1.md` §T2, ABI-unknown fallback). Other logs in
 * the same response stay decoded.
 */
export interface CompressedLogUnknown extends CompressedLogT1 {
  _event_unknown: true;
}

export type CompressedLog = CompressedLogT1 | CompressedLogT2 | CompressedLogUnknown;
