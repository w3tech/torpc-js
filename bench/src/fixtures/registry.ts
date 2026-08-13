import type { Fixture } from '../types/index.ts';
import { PINNED_BLOCK, THIRTY_DAY_BLOCKS } from '../types/index.ts';

/**
 * Registry of all 15 benchmark fixtures, pinned to block 21540854 (early 2025 era,
 * deeply finalized at time of capture). Capture scripts read this and snapshot
 * one folder per ID into fixtures/{kind}/{id}/.
 */
export const FIXTURES: Fixture[] = [
  // ---------- WALLETS (5) ----------
  {
    id: 'W1',
    kind: 'wallet',
    description: 'Whale — high transaction volume (Bitfinex hot wallet, historical)',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  },
  {
    id: 'W2',
    kind: 'wallet',
    description: 'High-activity exchange address (Binance 14)',
    address: '0x28C6c06298d514Db089934071355E5743bf21d60',
  },
  {
    id: 'W3',
    kind: 'wallet',
    description: 'NFT-heavy collector (Pranksy)',
    address: '0x6CC5F688a315f3dC28A7781717a9A798a59fDA7b',
  },
  {
    id: 'W4',
    kind: 'wallet',
    description: 'Low-activity edge case — burn address',
    address: '0x000000000000000000000000000000000000dEaD',
  },
  {
    id: 'W5',
    kind: 'wallet',
    description: 'Contract account — USDT contract',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },

  // ---------- TRANSACTIONS (5) ----------
  // Selectors resolved at capture time by scanning the pinned block's tx list.
  {
    id: 'T1',
    kind: 'transaction',
    description: 'Simple ERC-20 transfer (function selector 0xa9059cbb)',
    selector: { type: 'sample', criterion: 'simple_erc20_transfer' },
  },
  {
    id: 'T2',
    kind: 'transaction',
    description: 'Uniswap V3 swap (multi-event)',
    selector: { type: 'sample', criterion: 'uniswap_v3_swap' },
  },
  {
    id: 'T3',
    kind: 'transaction',
    description: 'NFT mint (Transfer event with from=0x0)',
    selector: { type: 'sample', criterion: 'nft_mint' },
  },
  {
    id: 'T4',
    kind: 'transaction',
    description: 'Failed transaction (status = 0)',
    selector: { type: 'sample', criterion: 'failed_tx' },
  },
  {
    id: 'T5',
    kind: 'transaction',
    description: 'Contract deployment (to = null)',
    selector: { type: 'sample', criterion: 'contract_deployment' },
  },

  // ---------- LOG RANGES (3) ----------
  {
    id: 'L1',
    kind: 'logs',
    description: 'USDC Transfer events on small range (~5 blocks) — aggregation baseline',
    fromBlock: PINNED_BLOCK - 4n,
    toBlock: PINNED_BLOCK,
    filter: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'], // Transfer(address,address,uint256)
    },
  },
  {
    id: 'L2',
    kind: 'logs',
    description: 'USDC Transfer events on wider range (~50 blocks) — truncation pressure',
    fromBlock: PINNED_BLOCK - 49n,
    toBlock: PINNED_BLOCK,
    filter: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
    },
  },
  {
    id: 'L3',
    kind: 'logs',
    description: 'Mixed Transfer events from USDC + WETH (multi-address)',
    fromBlock: PINNED_BLOCK - 4n,
    toBlock: PINNED_BLOCK,
    filter: {
      address: [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      ],
      topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
    },
  },

  // ---------- BLOCKS (2) ----------
  {
    id: 'B1',
    kind: 'block',
    description: 'Pinned reference block (recent at capture time)',
    blockNumber: PINNED_BLOCK,
  },
  {
    id: 'B2',
    kind: 'block',
    description: 'Older archive block — provenance + freshness baseline',
    blockNumber: 17_000_000n,
  },
];

/** 30-day lookback window relative to PINNED_BLOCK — used by wallet history queries. */
export const WALLET_HISTORY_FROM_BLOCK = PINNED_BLOCK - THIRTY_DAY_BLOCKS;
