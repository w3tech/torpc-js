/**
 * Per-method compressors. Each function takes the raw RPC `result` and returns a
 * compact, semantic object that goes inside our envelope.
 */
import {
  classifyAction,
  compactLog,
  decodeTopic,
  finalityForBlock,
  hexToDec,
  resolveAddress,
  topN,
  weiToEth,
} from './rules.ts';
import { PINNED_BLOCK } from '../../types/index.ts';

// ---------------- eth_getTransactionReceipt ----------------

interface RawReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  from: string;
  to: string | null;
  contractAddress: string | null;
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
  logs: { address: string; topics: string[]; data: string }[];
}

export function compressReceipt(raw: unknown) {
  const r = raw as RawReceipt;
  const action = classifyAction(r);
  return {
    tx: r.transactionHash,
    block: Number(hexToDec(r.blockNumber)),
    from: r.from,
    to: r.to ? resolveAddress(r.to) : null,
    status: r.status === '0x1' ? 'success' : 'failed',
    fee: {
      gas: Number(hexToDec(r.gasUsed)),
      gas_price_gwei: Number(BigInt(r.effectiveGasPrice) / 10n ** 9n),
    },
    log_count: r.logs?.length ?? 0,
    action,
    finality: finalityForBlock(BigInt(r.blockNumber)),
    raw_pointer: `ankr://rpc/eth/receipt/${r.transactionHash}`,
  };
}

// ---------------- eth_getTransactionByHash ----------------

interface RawTx {
  hash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  value: string;
  input: string;
  nonce: string;
}

export function compressTransaction(raw: unknown) {
  const t = raw as RawTx;
  return {
    tx: t.hash,
    block: Number(hexToDec(t.blockNumber)),
    from: t.from,
    to: t.to ? resolveAddress(t.to) : null,
    value: weiToEth(t.value),
    nonce: Number(hexToDec(t.nonce)),
    input_size_bytes: (t.input.length - 2) / 2,
    finality: finalityForBlock(BigInt(t.blockNumber)),
    raw_pointer: `ankr://rpc/eth/tx/${t.hash}`,
  };
}

// ---------------- eth_getBlockByNumber (full block) ----------------

interface RawBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  gasUsed: string;
  gasLimit: string;
  transactions: { hash: string }[] | string[];
}

export function compressBlock(raw: unknown) {
  const b = raw as RawBlock;
  const txCount = Array.isArray(b.transactions) ? b.transactions.length : 0;
  const ts = Number(hexToDec(b.timestamp));
  return {
    block: Number(hexToDec(b.number)),
    hash: b.hash,
    parent: b.parentHash,
    time: new Date(ts * 1000).toISOString(),
    tx_count: txCount,
    gas_used: Number(hexToDec(b.gasUsed)),
    gas_limit: Number(hexToDec(b.gasLimit)),
    utilisation_pct: Math.round(Number((BigInt(b.gasUsed) * 100n) / BigInt(b.gasLimit)) * 100) / 100,
    finality: finalityForBlock(BigInt(b.number)),
    raw_pointer: `ankr://rpc/eth/block/${Number(hexToDec(b.number))}`,
  };
}

// ---------------- eth_getLogs ----------------

interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

export function compressLogs(raw: unknown) {
  const logs = (raw as RawLog[]) ?? [];

  // Aggregate by (contract, event, counterparty triple isn't useful — aggregate by contract+event)
  const buckets = new Map<string, { contract: string; event: string; count: number; total: bigint }>();
  for (const l of logs) {
    const contract = resolveAddress(l.address);
    const event = decodeTopic(l.topics[0] ?? '');
    const key = `${contract}|${event}`;
    const b = buckets.get(key) ?? { contract, event, count: 0, total: 0n };
    b.count += 1;
    // For Transfer events, data is the value
    if (event === 'Transfer' && l.data && l.data !== '0x') {
      try {
        b.total += BigInt(l.data);
      } catch {
        // skip
      }
    }
    buckets.set(key, b);
  }

  const summary = Array.from(buckets.values()).map((b) => ({
    contract: b.contract,
    event: b.event,
    count: b.count,
    ...(b.total !== 0n ? { total_raw: b.total.toString() } : {}),
  }));

  // Top-3 samples for inspection
  const samples = logs.slice(0, 3).map(compactLog);

  const blocks = logs.map((l) => Number(hexToDec(l.blockNumber)));
  const minBlock = blocks.length ? Math.min(...blocks) : 0;
  const maxBlock = blocks.length ? Math.max(...blocks) : 0;

  return {
    total: logs.length,
    range: { from_block: minBlock, to_block: maxBlock },
    by_event: summary,
    samples,
    finality: 'confirmed',
    raw_pointer: `ankr://rpc/eth/logs?range=${minBlock}-${maxBlock}`,
  };
}

// ---------------- eth_getBalance ----------------

export function compressBalance(raw: unknown) {
  const balanceHex = raw as string;
  return {
    balance: weiToEth(balanceHex),
    as_of_block: Number(PINNED_BLOCK),
    finality: 'confirmed',
  };
}

// ---------------- eth_getTransactionCount ----------------

export function compressTransactionCount(raw: unknown) {
  return {
    nonce: Number(hexToDec(raw as string)),
    as_of_block: Number(PINNED_BLOCK),
  };
}

// ---------------- ankr_getAccountBalance ----------------

interface RawAccountBalance {
  totalBalanceUsd?: string;
  assets?: {
    blockchain: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimals: number;
    contractAddress?: string;
    balance: string;
    balanceRawInteger?: string;
    balanceUsd?: string;
    tokenPrice?: string;
  }[];
}

export function compressAccountBalance(raw: unknown) {
  const r = raw as RawAccountBalance;
  const holdings = (r.assets ?? [])
    .filter((a) => parseFloat(a.balance) > 0)
    .map((a) => ({
      asset: a.tokenSymbol,
      amount: a.balance,
      usd: a.balanceUsd,
    }));
  return {
    holdings,
    total_usd: r.totalBalanceUsd,
    finality: 'confirmed',
    raw_pointer: `ankr://aapi/account-balance`,
  };
}

// ---------------- ankr_getTokenTransfers ----------------

interface RawTokenTransfers {
  transfers?: {
    fromAddress: string;
    toAddress: string;
    contractAddress: string;
    value: string;
    valueRawInteger: string;
    tokenSymbol: string;
    tokenName?: string;
    tokenDecimals: number;
    blockchain: string;
    timestamp: number;
    transactionHash: string;
    blockHeight: number;
  }[];
  nextPageToken?: string;
}

export function compressTokenTransfers(raw: unknown) {
  const r = raw as RawTokenTransfers;
  const transfers = r.transfers ?? [];

  // Aggregate by token
  const byToken = new Map<string, { symbol: string; transfers: number; total: number }>();
  for (const t of transfers) {
    const key = t.tokenSymbol;
    const e = byToken.get(key) ?? { symbol: key, transfers: 0, total: 0 };
    e.transfers += 1;
    e.total += parseFloat(t.value);
    byToken.set(key, e);
  }

  const tokens_seen = Array.from(byToken.values())
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 5);

  const uniqueCounterparties = new Set<string>();
  for (const t of transfers) {
    uniqueCounterparties.add(t.fromAddress);
    uniqueCounterparties.add(t.toAddress);
  }

  // Top 3 by value
  const top = topN(transfers, 3, (t) => parseFloat(t.value)).map((t) => ({
    time: new Date(t.timestamp * 1000).toISOString(),
    asset: t.tokenSymbol,
    amount: t.value,
    from: t.fromAddress,
    to: t.toAddress,
    block: t.blockHeight,
  }));

  return {
    total: transfers.length,
    truncated: !!r.nextPageToken,
    summary: {
      tokens_seen,
      counterparties_unique: uniqueCounterparties.size,
    },
    top,
    cursor: r.nextPageToken ?? null,
    finality: 'confirmed',
    raw_pointer: `ankr://aapi/transfers`,
  };
}

// ---------------- ankr_getNFTsByOwner ----------------

interface RawNFTs {
  assets?: {
    blockchain: string;
    name: string;
    tokenId: string;
    contractAddress: string;
    collectionName?: string;
    contractType: string;
    traits?: { trait_type: string; value: string }[];
  }[];
  nextPageToken?: string;
}

export function compressNFTs(raw: unknown) {
  const r = raw as RawNFTs;
  const assets = r.assets ?? [];

  // Group by collection
  const byCollection = new Map<string, { name: string; contract: string; count: number; standard: string }>();
  for (const a of assets) {
    const key = a.collectionName ?? a.name;
    const e = byCollection.get(key) ?? { name: key, contract: a.contractAddress, count: 0, standard: a.contractType };
    e.count += 1;
    byCollection.set(key, e);
  }

  const collections = Array.from(byCollection.values()).sort((a, b) => b.count - a.count);

  return {
    total: assets.length,
    truncated: !!r.nextPageToken,
    collections,
    cursor: r.nextPageToken ?? null,
    raw_pointer: `ankr://aapi/nfts`,
  };
}
