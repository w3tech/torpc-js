/**
 * Shared types across the benchmark suite.
 */

/** A fixture is a captured snapshot of one logical "data subject" — wallet, tx, log range, or block. */
export type FixtureKind = 'wallet' | 'transaction' | 'logs' | 'block';

export interface FixtureId {
  /** Short slug used in filenames, e.g. "W1", "T2", "L1", "B1". */
  id: string;
  kind: FixtureKind;
  /** Free-text description, kept in the registry for human readers. */
  description: string;
}

export interface WalletFixture extends FixtureId {
  kind: 'wallet';
  address: `0x${string}`;
}

export interface TransactionFixture extends FixtureId {
  kind: 'transaction';
  /** Either explicit hash, or a selector that the capture script resolves at runtime. */
  selector: { type: 'hash'; hash: `0x${string}` } | { type: 'sample'; criterion: TxSampleCriterion };
}

export type TxSampleCriterion =
  | 'simple_erc20_transfer'
  | 'uniswap_v3_swap'
  | 'nft_mint'
  | 'failed_tx'
  | 'contract_deployment';

export interface LogsFixture extends FixtureId {
  kind: 'logs';
  fromBlock: bigint;
  toBlock: bigint;
  filter: {
    address?: `0x${string}` | `0x${string}`[];
    topics?: (`0x${string}` | null)[];
  };
}

export interface BlockFixture extends FixtureId {
  kind: 'block';
  blockNumber: bigint;
}

export type Fixture = WalletFixture | TransactionFixture | LogsFixture | BlockFixture;

/** A captured response from RPC/AAPI, persisted on disk per (fixture, method). */
export interface CapturedResponse {
  fixtureId: string;
  method: string;
  /** When the snapshot was taken (UTC ISO). */
  capturedAt: string;
  /** What pinned block was used (so future captures of same fixture are deterministic). */
  pinnedBlock: string;
  /** Raw RPC/AAPI response — what the server returned. */
  result: unknown;
  /** If this came from AAPI rather than ETH JSON-RPC. */
  source: 'eth_jsonrpc' | 'ankr_aapi';
}

/** Output of a format adapter — the encoded body that will be fed to an LLM and the underlying object for scoring. */
export interface EncodedPayload {
  /** Format name, e.g. "raw_rpc" / "compressed_v1" / "fields_projected" / "toon". */
  format: string;
  /** What goes into the LLM prompt verbatim. */
  body: string;
  /** Content-Type if we want to emit one. */
  contentType: string;
  /** Parseable form for scorer use. */
  raw: unknown;
}

/** Token-count result for one (payload, tokenizer) pair. */
export interface TokenCount {
  format: string;
  tokenizer: TokenizerName;
  tokens: number;
  bytes: number;
}

export type TokenizerName = 'o200k_base' | 'cl100k_base' | 'claude' | 'gemini';

/** Pinned reference block — every fixture and query is relative to this. */
export const PINNED_BLOCK = 21540854n;

/** 30-day lookback window in blocks (12 s avg block time on Ethereum mainnet). */
export const THIRTY_DAY_BLOCKS = 216_000n;
