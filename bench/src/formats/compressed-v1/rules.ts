/**
 * Reusable transformation rules used by per-method compressors.
 * Each rule is a pure function; methods compose them.
 */

import { PINNED_BLOCK } from '../../types/index.ts';

// ---- Known event topic[0] → human name ----
/**
 * Trim trailing zeros from a fixed-width decimal fragment. A `/0+$/` regex here is
 * super-linear on adversarial input; a scan is linear and does the same job.
 */
function trimTrailingZeros(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === '0') end--;
  return s.slice(0, end);
}

export const EVENT_NAMES: Record<string, string> = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer',
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'Approval',
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67': 'Swap', // Uniswap V3
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': 'Swap', // Uniswap V2
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'Sync', // V2 pair
  '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7': 'TransferSingle', // ERC-1155
  '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb': 'TransferBatch', // ERC-1155
};

// ---- Known contract addresses → labels ----
export const KNOWN_ADDRESSES: Record<string, string> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'UniV3Router2',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'UniV3Router',
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af': 'UniV4Router',
};

const ERC20_DECIMALS: Record<string, number> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6, // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 6, // USDT
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 18, // WETH
  '0x6b175474e89094c44da98b954eedeac495271d0f': 18, // DAI
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8, // WBTC
};

// ---- Rule 1: strip 32-byte zero padding from a topic address ----
export function stripTopicPadding(topic: string): string {
  if (!topic.startsWith('0x') || topic.length !== 66) return topic;
  // Topic addresses are 32 bytes with the address in the low 20.
  // Pattern: 0x + 24 zeros + 40 hex chars
  if (/^0x0{24}[a-f0-9]{40}$/i.test(topic)) {
    return `0x${topic.slice(26)}`;
  }
  return topic;
}

// ---- Rule 2: hex 0x... → decimal number ----
export function hexToDec(hex: string): string {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return hex;
  try {
    return BigInt(hex).toString(10);
  } catch {
    return hex;
  }
}

// ---- Rule 3: decode topic[0] → event name ----
export function decodeTopic(topic0: string): string {
  return EVENT_NAMES[topic0.toLowerCase()] ?? topic0;
}

// ---- Rule 4: resolve known contract address → label ----
export function resolveAddress(addr: string): string {
  return KNOWN_ADDRESSES[addr.toLowerCase()] ?? addr;
}

// ---- Rule 5: wei (bigint hex) → ETH decimal string ----
export function weiToEth(weiHex: string): string {
  if (!weiHex.startsWith('0x')) return weiHex;
  const wei = BigInt(weiHex);
  const eth = wei / 10n ** 18n;
  const rem = wei % 10n ** 18n;
  if (rem === 0n) return `${eth} ETH`;
  // Show 6 significant decimals
  const decimals = trimTrailingZeros(rem.toString().padStart(18, '0').slice(0, 6));
  return decimals ? `${eth}.${decimals} ETH` : `${eth} ETH`;
}

// ---- Rule 6: USD-style amount from raw token integer + decimals ----
export function tokenAmount(rawHex: string, contractAddr: string): string {
  if (typeof rawHex !== 'string' || !rawHex.startsWith('0x') || rawHex.length <= 2) return rawHex;
  let raw: bigint;
  try {
    raw = BigInt(rawHex);
  } catch {
    return rawHex;
  }
  const decimals = ERC20_DECIMALS[contractAddr.toLowerCase()] ?? 18;
  const div = 10n ** BigInt(decimals);
  const whole = raw / div;
  const rem = raw % div;
  if (rem === 0n) return whole.toString();
  const decStr = trimTrailingZeros(rem.toString().padStart(decimals, '0').slice(0, 4));
  return decStr ? `${whole}.${decStr}` : whole.toString();
}

// ---- Rule 7: finality flag from block number relative to pinned tip ----
export type Finality = 'confirmed' | 'safe' | 'latest' | 'pending' | 'reverted';

export function finalityForBlock(blockNumber: bigint): Finality {
  // Our fixtures snapshot the chain at PINNED_BLOCK; at any time the benchmark
  // is later run (hours, days, or weeks later) every block at or before that
  // snapshot is deeply finalized. We don't model live-chain finality here —
  // the benchmark deliberately operates on historical pinned data.
  if (blockNumber <= PINNED_BLOCK) return 'confirmed';
  // Anything ahead of pinned shouldn't appear in our fixtures; if it does,
  // we have no information about it.
  return 'latest';
}

// ---- Rule 8: classify a tx receipt's semantic action from its logs ----
export interface ClassifiedAction {
  type: 'transfer' | 'swap' | 'approve' | 'mint' | 'burn' | 'contract_deployment' | 'failed' | 'other';
  asset?: string;
  amount?: string;
  from?: string;
  to?: string;
}

interface ReceiptLog {
  address?: string;
  topics?: string[];
  data?: string;
}

export function classifyAction(receipt: {
  status?: string;
  to?: string | null;
  contractAddress?: string | null;
  logs?: ReceiptLog[];
}): ClassifiedAction {
  if (receipt.status === '0x0') return { type: 'failed' };
  if (!receipt.to && receipt.contractAddress) return { type: 'contract_deployment', to: receipt.contractAddress };

  const logs = receipt.logs ?? [];

  // Look for Swap event first (V2/V3)
  const swap = logs.find((l) => {
    const t0 = l.topics?.[0]?.toLowerCase();
    return (
      t0 === '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67' ||
      t0 === '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
    );
  });
  if (swap) return { type: 'swap' };

  // Look for Transfer event with from=0x0 → mint
  const transfer = logs.find(
    (l) => l.topics?.[0]?.toLowerCase() === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  );
  if (transfer) {
    const from = transfer.topics?.[1] ?? '';
    const to = transfer.topics?.[2] ?? '';
    const asset = resolveAddress(transfer.address ?? '');
    const amount = transfer.data ? tokenAmount(transfer.data, transfer.address ?? '') : undefined;
    if (/^0x0+$/i.test(from)) return { type: 'mint', asset, amount, to: stripTopicPadding(to) };
    if (/^0x0+$/i.test(to)) return { type: 'burn', asset, amount, from: stripTopicPadding(from) };
    return {
      type: 'transfer',
      asset,
      amount,
      from: stripTopicPadding(from),
      to: stripTopicPadding(to),
    };
  }

  // Look for Approval
  const approval = logs.find(
    (l) => l.topics?.[0]?.toLowerCase() === '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
  );
  if (approval) return { type: 'approve', asset: resolveAddress(approval.address ?? '') };

  return { type: 'other' };
}

// ---- Rule 9: drop service fields from a log ----
export function compactLog(log: ReceiptLog): Record<string, unknown> {
  const decoded: Record<string, unknown> = {};
  if (log.address) decoded.contract = resolveAddress(log.address);
  if (log.topics?.[0]) decoded.event = decodeTopic(log.topics[0]);
  if (log.topics && log.topics.length > 1) {
    decoded.params = log.topics.slice(1).map(stripTopicPadding);
  }
  if (log.data && log.data !== '0x') decoded.data = log.data;
  return decoded;
}

// ---- Rule 10: top-N items from an array, by abs-numeric field ----
export function topN<T>(arr: T[], n: number, getValue: (x: T) => number): T[] {
  return [...arr].sort((a, b) => Math.abs(getValue(b)) - Math.abs(getValue(a))).slice(0, n);
}
