/**
 * Capture raw / T1 / T2 of every benchmark method from OUR production proxy by
 * issuing the SAME request three times with `Accept-Token-Tier: 0|1|2`.
 * Optionally also captures an EXTERNAL raw baseline (any standard RPC) so a user
 * can compare Ankr tiers both against an external provider and between tiers.
 *
 * No local encoder — the three formats are authentic production output.
 *
 * Env:
 *   ANKR_RPC_URL   (required)  e.g. https://rpc.ankr.com/eth/<KEY>   — supports tiers
 *   RAW_RPC_URL    (optional)  any standard ETH JSON-RPC endpoint (external raw baseline)
 *   PINNED_BLOCK   (optional)  decimal block number; default in manifest
 *
 * Output: data/fixtures/<method>/<sampleId>.json  +  data/resolved-manifest.json
 * Run:    pnpm capture:tiers   (see package.json)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { requireEnv } from '../secrets/index.ts';
import { captureTier, jsonRpc, bigToHex } from './rpc-client.ts';
import {
  DEFAULT_PINNED_BLOCK,
  TIERS,
  SCALAR_SPECS,
  LOG_RANGES,
  BALANCE_SUBJECTS,
  TX_CRITERIA,
  ADDR,
  TRANSFER_TOPIC,
  coverageOf,
  type TxCriterion,
} from '../fixtures/manifest.ts';

const DATA_DIR = new URL('../../data/fixtures/', import.meta.url).pathname;
const RESOLVED_PATH = new URL('../../data/resolved-manifest.json', import.meta.url).pathname;

const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';
const UNISWAP_V3_SWAP_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
const UNISWAP_V2_SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

const PINNED_BLOCK = process.env.PINNED_BLOCK ? BigInt(process.env.PINNED_BLOCK) : DEFAULT_PINNED_BLOCK;

interface SampleFile {
  method: string;
  sampleId: string;
  description: string;
  params: unknown;
  coverage: string;
  pinnedBlock: string;
  capturedAt: string;
  /** keyed by tier "0"|"1"|"2" */
  tiers: Record<string, { tokenTier: string | null; resultBody: string; error?: unknown }>;
  /** external raw baseline (if RAW_RPC_URL set) */
  rawExt?: { resultBody: string };
}

const resolved: Record<string, unknown> = { pinnedBlock: PINNED_BLOCK.toString(), txHashes: {} };

async function captureSample(
  ankrUrl: string,
  rawUrl: string | undefined,
  method: string,
  sampleId: string,
  params: unknown,
  description: string,
): Promise<void> {
  const tiers: SampleFile['tiers'] = {};
  for (const tier of TIERS) {
    try {
      const cap = await captureTier(ankrUrl, method, params, tier);
      tiers[String(tier)] = { tokenTier: cap.tokenTier, resultBody: cap.resultBody, ...(cap.error ? { error: cap.error } : {}) };
    } catch (e) {
      tiers[String(tier)] = { tokenTier: null, resultBody: '', error: (e as Error).message };
    }
  }
  let rawExt: SampleFile['rawExt'];
  if (rawUrl) {
    try {
      const result = await jsonRpc<unknown>(rawUrl, method, params);
      rawExt = { resultBody: JSON.stringify(result) };
    } catch (e) {
      rawExt = { resultBody: `ERROR: ${(e as Error).message}` };
    }
  }
  const file: SampleFile = {
    method,
    sampleId,
    description,
    params,
    coverage: coverageOf(method),
    pinnedBlock: PINNED_BLOCK.toString(),
    capturedAt: new Date().toISOString(),
    tiers,
    ...(rawExt ? { rawExt } : {}),
  };
  const dir = join(DATA_DIR, method);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${sampleId}.json`), JSON.stringify(file, null, 2) + '\n');
  const t0 = tiers['0']?.resultBody.length ?? 0;
  const t2 = tiers['2']?.resultBody.length ?? 0;
  const delta = t0 > 0 ? `${Math.round((1 - t2 / t0) * 100)}% smaller@T2` : '';
  console.log(`  ✓ ${method}/${sampleId}  ${delta}`);
}

interface BlockTx {
  hash: `0x${string}`;
  to: `0x${string}` | null;
  input: `0x${string}`;
  transactionIndex: string;
}
interface FullBlock {
  hash: string;
  transactions: BlockTx[];
}

async function fetchBlock(ankrUrl: string, n: bigint): Promise<FullBlock> {
  return jsonRpc<FullBlock>(ankrUrl, 'eth_getBlockByNumber', [bigToHex(n), true]);
}

async function selectTxHash(criterion: TxCriterion, block: FullBlock, ankrUrl: string): Promise<`0x${string}` | null> {
  if (criterion === 'simple_erc20_transfer') {
    return block.transactions.find((t) => t.to && t.input.toLowerCase().startsWith(ERC20_TRANSFER_SELECTOR) && t.input.length === 138)?.hash ?? null;
  }
  if (criterion === 'contract_deployment') {
    // contract creation = to === null. Walk back up to 25 blocks if the pinned block has none.
    for (let off = 0n; off <= 25n; off++) {
      const b = off === 0n ? block : await fetchBlock(ankrUrl, PINNED_BLOCK - off);
      const tx = b.transactions.find((t) => t.to === null && t.input.length > 10);
      if (tx) return tx.hash;
    }
    return null;
  }
  // swap / nft_mint / failed_tx need receipts. Walk back a few blocks if not found.
  // failed_tx scans ALL txs (a failed tx may be a plain call); swap/nft only contract calls.
  const maxBlocks = criterion === 'failed_tx' ? 4n : 1n;
  for (let off = 0n; off <= maxBlocks; off++) {
    const b = off === 0n ? block : await fetchBlock(ankrUrl, PINNED_BLOCK - off);
    const cands = (criterion === 'failed_tx' ? b.transactions : b.transactions.filter((t) => t.to && t.input.length > 10)).slice(0, 100);
    for (const tx of cands) {
      const r = await jsonRpc<{ logs: { topics: string[] }[]; status: string }>(ankrUrl, 'eth_getTransactionReceipt', [tx.hash]);
      if (criterion === 'failed_tx' && r.status === '0x0') return tx.hash;
      if (criterion === 'uniswap_v3_swap' && r.logs.some((l) => [UNISWAP_V3_SWAP_TOPIC, UNISWAP_V2_SWAP_TOPIC].includes((l.topics[0] ?? '').toLowerCase()))) return tx.hash;
      if (criterion === 'nft_mint' && r.logs.some((l) => l.topics.length >= 3 && (l.topics[0] ?? '').toLowerCase() === TRANSFER_TOPIC && /^0x0+$/.test((l.topics[1] ?? '').toLowerCase()))) return tx.hash;
    }
  }
  return null;
}

async function main(): Promise<void> {
  // Build the tier endpoint. Prefer a full ANKR_RPC_URL if given; else build from the
  // key (ANKR_RPC_KEY) + a URL template. Default = the public endpoint in path-auth form,
  // which honours Accept-Token-Tier (verified 2026-06-17). Override the template if your
  // deployment authenticates with a query parameter instead.
  let ankrUrl = process.env.ANKR_RPC_URL;
  if (!ankrUrl) {
    const key = requireEnv('ANKR_RPC_KEY');
    const chain = process.env.BENCH_CHAIN || 'eth';
    const template = process.env.ANKR_RPC_URL_TEMPLATE || 'https://rpc.ankr.com/{chain}/{key}';
    ankrUrl = template.replace('{chain}', chain).replace('{key}', key);
  }
  const rawUrl = process.env.RAW_RPC_URL || undefined;
  const pinnedHex = bigToHex(PINNED_BLOCK);
  console.log(`Capturing raw/T1/T2 from proxy, pinned block ${PINNED_BLOCK}${rawUrl ? ' (+ external raw baseline)' : ''}\n`);

  // Resolve the pinned block (hash + tx list) for hash/index-based methods + tx selection.
  const block = await jsonRpc<FullBlock>(ankrUrl, 'eth_getBlockByNumber', [pinnedHex, true]);
  const blockHash = block.hash;
  resolved.blockHash = blockHash;

  // --- scalars (no-arg + block/hash-arg) ---
  console.log('Scalars');
  for (const s of SCALAR_SPECS) {
    let params: string[] = [];
    if (s.needs === 'blockHex') params = [pinnedHex];
    else if (s.needs === 'blockHash') params = [blockHash];
    await captureSample(ankrUrl, rawUrl, s.method, 'default', params, `${s.method} scalar`);
  }

  // --- blocks ---
  console.log('Blocks');
  await captureSample(ankrUrl, rawUrl, 'eth_getBlockByNumber', 'pinned_full', [pinnedHex, true], 'pinned block, full tx objects');
  await captureSample(ankrUrl, rawUrl, 'eth_getBlockByHash', 'pinned_full', [blockHash, true], 'pinned block by hash, full tx');
  await captureSample(ankrUrl, rawUrl, 'eth_getBlockReceipts', 'pinned', [pinnedHex], 'all receipts in pinned block');

  // --- tx by block + index (index 0) ---
  await captureSample(ankrUrl, rawUrl, 'eth_getTransactionByBlockNumberAndIndex', 'idx0', [pinnedHex, '0x0'], 'first tx of pinned block by number+index');
  await captureSample(ankrUrl, rawUrl, 'eth_getTransactionByBlockHashAndIndex', 'idx0', [blockHash, '0x0'], 'first tx of pinned block by hash+index');

  // --- uncles (likely empty post-merge; captured for completeness) ---
  await captureSample(ankrUrl, rawUrl, 'eth_getUncleByBlockNumberAndIndex', 'idx0', [pinnedHex, '0x0'], 'uncle by number+index (post-merge: null)');
  await captureSample(ankrUrl, rawUrl, 'eth_getUncleByBlockHashAndIndex', 'idx0', [blockHash, '0x0'], 'uncle by hash+index (post-merge: null)');

  // --- balances / nonces ---
  console.log('Balances / nonces');
  for (const [i, addr] of BALANCE_SUBJECTS.entries()) {
    await captureSample(ankrUrl, rawUrl, 'eth_getBalance', `s${i}`, [addr, pinnedHex], `balance of ${addr}`);
    await captureSample(ankrUrl, rawUrl, 'eth_getTransactionCount', `s${i}`, [addr, pinnedHex], `nonce of ${addr}`);
  }

  // --- estimateGas / feeHistory ---
  await captureSample(ankrUrl, rawUrl, 'eth_estimateGas', 'transfer', [{ from: ADDR.vitalik, to: ADDR.WETH, value: '0x1' }], 'estimate gas of a 1-wei value transfer');
  await captureSample(ankrUrl, rawUrl, 'eth_feeHistory', 'p5', [5, pinnedHex, [25, 50, 75]], 'fee history, 5 blocks, p25/50/75');

  // --- logs ranges ---
  console.log('Logs');
  for (const lr of LOG_RANGES) {
    const params = [{
      fromBlock: bigToHex(PINNED_BLOCK - lr.fromBack),
      toBlock: bigToHex(PINNED_BLOCK - lr.toBack),
      ...(lr.address ? { address: lr.address } : {}),
      ...(lr.topics ? { topics: lr.topics } : {}),
    }];
    await captureSample(ankrUrl, rawUrl, 'eth_getLogs', lr.id, params, lr.description);
  }

  // --- transactions (5 criteria) → getTransactionByHash + getTransactionReceipt ---
  console.log('Transactions (by criterion)');
  for (const crit of TX_CRITERIA) {
    const hash = await selectTxHash(crit, block, ankrUrl);
    (resolved.txHashes as Record<string, string | null>)[crit] = hash;
    if (!hash) {
      console.warn(`  ⚠ no match for ${crit} in pinned block — skipped`);
      continue;
    }
    await captureSample(ankrUrl, rawUrl, 'eth_getTransactionByHash', crit, [hash], `tx (${crit})`);
    await captureSample(ankrUrl, rawUrl, 'eth_getTransactionReceipt', crit, [hash], `receipt (${crit})`);
  }

  // --- unsupported (raw-only baseline; tiers should equal raw) ---
  console.log('Unsupported (baseline)');
  const balanceOfData = `0x70a08231${ADDR.vitalik.slice(2).toLowerCase().padStart(64, '0')}`;
  await captureSample(ankrUrl, rawUrl, 'eth_call', 'usdc_balanceof', [{ to: ADDR.USDC, data: balanceOfData }, pinnedHex], 'USDC.balanceOf(vitalik)');
  await captureSample(ankrUrl, rawUrl, 'eth_getCode', 'usdc', [ADDR.USDC, pinnedHex], 'USDC bytecode');
  await captureSample(ankrUrl, rawUrl, 'eth_getStorageAt', 'usdc_slot0', [ADDR.USDC, '0x0', pinnedHex], 'USDC storage slot 0');

  await writeFile(RESOLVED_PATH, JSON.stringify(resolved, null, 2) + '\n');
  console.log(`\n✓ done. Fixtures: data/fixtures/  ·  resolved manifest: data/resolved-manifest.json`);
}

main().catch((err: unknown) => {
  console.error('✗ capture-tiers failed:', err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});
