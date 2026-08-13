/**
 * Public-benchmark manifest (v2 — tier capture model).
 *
 * Defines WHAT to capture for the raw/T1/T2 comparison across the 24 production
 * TORPC methods (+3 unsupported, kept as a raw-only baseline). The capture step
 * (capture-tiers.ts) hits OUR production proxy with `Accept-Token-Tier: 0|1|2`,
 * so the three "formats" are authentic production output — no local encoder.
 *
 * ETH mainnet, v1. Pin a block via env PINNED_BLOCK (decimal); default below.
 * Addresses are well-known mainnet constants — edit to taste.
 */

// Verified finalized ETH mainnet block (2026-06-17). Override with PINNED_BLOCK env.
export const DEFAULT_PINNED_BLOCK = 25338339n;

export const TIERS = [0, 1, 2] as const;
export type Tier = (typeof TIERS)[number];

/** Method coverage classes (verified live against the served endpoint). Used for reporting groups. */
export const FULL_T2_METHODS = [
  'eth_getTransactionReceipt',
  'eth_getLogs',
  'eth_getBlockReceipts',
  'eth_getTransactionByHash',
  'eth_getTransactionByBlockHashAndIndex',
  'eth_getTransactionByBlockNumberAndIndex',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
] as const;

export const PARTIAL_T1_METHODS = [
  'eth_blockNumber',
  'eth_chainId',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_blobBaseFee',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_estimateGas',
  'eth_getBlockTransactionCountByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_getUncleCountByBlockHash',
  'eth_getUncleCountByBlockNumber',
  'eth_feeHistory',
  'eth_getUncleByBlockHashAndIndex',
  'eth_getUncleByBlockNumberAndIndex',
] as const;

/** Not transformed by TORPC today — captured raw-only to make the gap visible. */
export const UNSUPPORTED_METHODS = ['eth_call', 'eth_getCode', 'eth_getStorageAt'] as const;

export type CoverageClass = 'full_t2' | 'partial_t1' | 'unsupported';

export function coverageOf(method: string): CoverageClass {
  if ((FULL_T2_METHODS as readonly string[]).includes(method)) return 'full_t2';
  if ((PARTIAL_T1_METHODS as readonly string[]).includes(method)) return 'partial_t1';
  return 'unsupported';
}

/** Well-known mainnet constants (stable). Edit if you want different subjects. */
export const ADDR = {
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  WETH: '0xC02aaa39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
} as const;

/** Tx sample criteria — resolved against the pinned block by the capture script. */
export const TX_CRITERIA = [
  'simple_erc20_transfer',
  'uniswap_v3_swap',
  'nft_mint',
  'failed_tx',
  'contract_deployment',
] as const;
export type TxCriterion = (typeof TX_CRITERIA)[number];

/** eth_getLogs ranges, expressed as block-offsets back from the pinned block. */
export interface LogRange {
  id: string;
  description: string;
  /** inclusive offsets back from pinned block: [from = pinned-fromBack, to = pinned-toBack] */
  fromBack: bigint;
  toBack: bigint;
  address?: string;
  topics?: (string | null)[];
}

// ERC-20 Transfer event topic[0]
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const LOG_RANGES: LogRange[] = [
  {
    id: 'L1_usdc_transfers_narrow',
    description: 'USDC Transfer events over a 1-block window (uniform, T2 sweet spot)',
    fromBack: 0n,
    toBack: 0n,
    address: ADDR.USDC,
    topics: [TRANSFER_TOPIC],
  },
  {
    id: 'L2_usdc_transfers_wide',
    description: 'USDC Transfer events over a 5-block window (larger array)',
    fromBack: 4n,
    toBack: 0n,
    address: ADDR.USDC,
    topics: [TRANSFER_TOPIC],
  },
  {
    id: 'L3_all_logs_one_block',
    description: 'All logs in the pinned block (mixed events, semi-uniform)',
    fromBack: 0n,
    toBack: 0n,
  },
];

/** Addresses for balance / txCount scalars. */
export const BALANCE_SUBJECTS = [ADDR.vitalik, ADDR.USDC] as const;

/** A no-arg or fixed-arg scalar capture spec. */
export interface ScalarSpec {
  method: string;
  /** params builder may need the pinned block / its hash. */
  needs: 'none' | 'blockHex' | 'blockHash' | 'address+blockHex';
}

export const SCALAR_SPECS: ScalarSpec[] = [
  { method: 'eth_blockNumber', needs: 'none' },
  { method: 'eth_chainId', needs: 'none' },
  { method: 'eth_gasPrice', needs: 'none' },
  { method: 'eth_maxPriorityFeePerGas', needs: 'none' },
  { method: 'eth_blobBaseFee', needs: 'none' },
  { method: 'eth_getBlockTransactionCountByNumber', needs: 'blockHex' },
  { method: 'eth_getBlockTransactionCountByHash', needs: 'blockHash' },
  { method: 'eth_getUncleCountByBlockNumber', needs: 'blockHex' },
  { method: 'eth_getUncleCountByBlockHash', needs: 'blockHash' },
];
