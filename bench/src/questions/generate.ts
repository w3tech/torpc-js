/**
 * Question generators — produce retrieval/aggregation/filtering/structure questions
 * with ground truth computed deterministically from the tier-0 (raw) fixture.
 * Mirrors TOON's approach: questions are generated from data, not hand-written.
 *
 * The QUESTION is phrased semantically so it is answerable from any tier
 * (raw hex, T1 decimal, or T2 decoded) — only the payload the model reads changes.
 *
 * Run: pnpm questions   → writes data/questions.json
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnswerType } from '../scorer/index.ts';
import { TRANSFER_TOPIC } from '../fixtures/manifest.ts';

const DATA_DIR = new URL('../../data/fixtures/', import.meta.url).pathname;
const OUT = new URL('../../data/questions.json', import.meta.url).pathname;

export type Category = 'retrieval' | 'aggregation' | 'filtering' | 'structure' | 'validity' | 'decoding';

export interface BenchQuestion {
  id: string;
  method: string;
  sampleId: string;
  category: Category;
  prompt: string;
  answerType: AnswerType;
  expected: string[];
}

interface SampleFile {
  method: string;
  sampleId: string;
  description: string;
  tiers: Record<string, { resultBody: string; error?: unknown }>;
}

const big = (v: unknown): bigint | null => {
  if (typeof v !== 'string') return null;
  try { return BigInt(v); } catch { return null; }
};
const isAddr = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

function q(method: string, sampleId: string, n: number, category: Category, prompt: string, answerType: AnswerType, expected: string | string[]): BenchQuestion {
  return { id: `${method}__${sampleId}__q${n}`, method, sampleId, category, prompt, answerType, expected: Array.isArray(expected) ? expected : [expected] };
}

/** Produce questions for one captured sample, from its tier-0 raw result. */
export function generateForSample(f: SampleFile): BenchQuestion[] {
  const rawBody = f.tiers['0']?.resultBody;
  if (!rawBody) return [];
  let r: unknown;
  try { r = JSON.parse(rawBody); } catch { return []; }
  const m = f.method;
  const s = f.sampleId;
  const out: BenchQuestion[] = [];

  // --- scalar quantity methods ---
  const SCALAR_QTY = new Set([
    'eth_blockNumber', 'eth_chainId', 'eth_gasPrice', 'eth_maxPriorityFeePerGas', 'eth_blobBaseFee',
    'eth_getBalance', 'eth_getTransactionCount', 'eth_estimateGas',
    'eth_getBlockTransactionCountByHash', 'eth_getBlockTransactionCountByNumber',
    'eth_getUncleCountByBlockHash', 'eth_getUncleCountByBlockNumber', 'eth_getStorageAt',
  ]);
  if (SCALAR_QTY.has(m)) {
    const v = big(r);
    if (v !== null) out.push(q(m, s, 1, 'retrieval', `What is the value returned by ${m} as a decimal integer?`, 'bigint', v.toString()));
    return out;
  }

  switch (m) {
    case 'eth_getBlockByNumber':
    case 'eth_getBlockByHash': {
      const b = r as { transactions?: unknown[]; gasUsed?: string; baseFeePerGas?: string; miner?: string };
      if (Array.isArray(b.transactions)) out.push(q(m, s, 1, 'structure', 'How many transactions are in this block?', 'integer', String(b.transactions.length)));
      const gu = big(b.gasUsed); if (gu !== null) out.push(q(m, s, 2, 'retrieval', 'What is the total gas used by this block, as a decimal integer?', 'bigint', gu.toString()));
      const bf = big(b.baseFeePerGas); if (bf !== null) out.push(q(m, s, 3, 'retrieval', 'What is the base fee per gas of this block, in wei as a decimal integer?', 'bigint', bf.toString()));
      if (isAddr(b.miner)) out.push(q(m, s, 4, 'retrieval', 'What is the miner / fee-recipient address of this block?', 'address', b.miner));
      break;
    }
    case 'eth_getBlockReceipts': {
      const arr = Array.isArray(r) ? (r as { logs?: unknown[]; status?: string }[]) : [];
      out.push(q(m, s, 1, 'structure', 'How many transaction receipts are in this block?', 'integer', String(arr.length)));
      const totalLogs = arr.reduce((a, x) => a + (Array.isArray(x.logs) ? x.logs.length : 0), 0);
      out.push(q(m, s, 2, 'aggregation', 'What is the total number of event logs across all receipts in this block?', 'integer', String(totalLogs)));
      const failed = arr.filter((x) => x.status === '0x0').length;
      out.push(q(m, s, 3, 'filtering', 'How many transactions in this block failed (status 0)?', 'integer', String(failed)));
      break;
    }
    case 'eth_getTransactionReceipt': {
      const rc = r as { status?: string; logs?: { topics?: string[]; data?: string; address?: string }[]; gasUsed?: string };
      if (rc.status !== undefined) out.push(q(m, s, 1, 'retrieval', 'Did this transaction succeed? Answer yes or no.', 'boolean', rc.status === '0x1' ? 'yes' : 'no'));
      const logs = Array.isArray(rc.logs) ? rc.logs : [];
      out.push(q(m, s, 2, 'aggregation', 'How many event logs did this transaction emit?', 'integer', String(logs.length)));
      const gu = big(rc.gasUsed); if (gu !== null) out.push(q(m, s, 3, 'retrieval', 'What is the gas used by this transaction, as a decimal integer?', 'bigint', gu.toString()));
      const transfers = logs.filter((l) => (l.topics?.[0] ?? '').toLowerCase() === TRANSFER_TOPIC);
      out.push(q(m, s, 4, 'filtering', 'How many ERC-20 Transfer events did this transaction emit?', 'integer', String(transfers.length)));
      const tl = transfers[0];
      if (tl && (tl.topics?.length ?? 0) >= 3) {
        out.push(q(m, s, 5, 'decoding', 'In the first ERC-20 Transfer event log, what is the recipient (to) address?', 'address', '0x' + tl.topics![2]!.slice(-40)));
        const v = big(tl.data); if (v !== null) out.push(q(m, s, 6, 'decoding', 'In the first ERC-20 Transfer event log, what is the transferred amount as a decimal integer?', 'bigint', v.toString()));
      }
      break;
    }
    case 'eth_getTransactionByHash':
    case 'eth_getTransactionByBlockNumberAndIndex':
    case 'eth_getTransactionByBlockHashAndIndex': {
      const t = r as { from?: string; to?: string | null; nonce?: string; value?: string; hash?: string; input?: string };
      if (isAddr(t.from)) out.push(q(m, s, 1, 'retrieval', 'What is the sender (from) address of this transaction?', 'address', t.from));
      if (isAddr(t.to)) out.push(q(m, s, 2, 'retrieval', 'What is the recipient (to) address of this transaction?', 'address', t.to));
      const nv = big(t.nonce); if (nv !== null) out.push(q(m, s, 3, 'retrieval', 'What is the nonce of this transaction, as a decimal integer?', 'bigint', nv.toString()));
      const vv = big(t.value); if (vv !== null) out.push(q(m, s, 4, 'retrieval', 'What is the value of this transaction, in wei as a decimal integer?', 'bigint', vv.toString()));
      const inp = t.input ?? '';
      if (inp.toLowerCase().startsWith('0xa9059cbb') && inp.length >= 138) {
        out.push(q(m, s, 5, 'decoding', 'What ERC-20 function does this transaction call? (function name)', 'freeform', 'transfer'));
        out.push(q(m, s, 6, 'decoding', 'In this ERC-20 transfer call, what recipient address is encoded in the calldata?', 'address', '0x' + inp.slice(34, 74)));
        const amt = big('0x' + inp.slice(74, 138)); if (amt !== null) out.push(q(m, s, 7, 'decoding', 'In this ERC-20 transfer call, what is the amount as a decimal integer (decoded from calldata)?', 'bigint', amt.toString()));
      }
      break;
    }
    case 'eth_getLogs': {
      const arr = Array.isArray(r) ? (r as { address?: string; topics?: string[]; data?: string }[]) : [];
      out.push(q(m, s, 1, 'structure', 'How many log entries are in this result?', 'integer', String(arr.length)));
      const distinct = new Set(arr.map((l) => (l.address ?? '').toLowerCase())).size;
      out.push(q(m, s, 2, 'aggregation', 'How many distinct contract addresses emitted these logs?', 'integer', String(distinct)));
      const tl = arr.find((l) => (l.topics?.[0] ?? '').toLowerCase() === TRANSFER_TOPIC && (l.topics?.length ?? 0) >= 3);
      if (tl) {
        out.push(q(m, s, 3, 'decoding', 'In the first ERC-20 Transfer log in this result, what is the recipient (to) address?', 'address', '0x' + tl.topics![2]!.slice(-40)));
        const v = big(tl.data); if (v !== null) out.push(q(m, s, 4, 'decoding', 'In the first ERC-20 Transfer log in this result, what is the transferred amount as a decimal integer?', 'bigint', v.toString()));
      }
      break;
    }
    case 'eth_feeHistory': {
      const fh = r as { baseFeePerGas?: string[]; oldestBlock?: string };
      if (Array.isArray(fh.baseFeePerGas)) out.push(q(m, s, 1, 'structure', 'How many baseFeePerGas entries are in this fee history?', 'integer', String(fh.baseFeePerGas.length)));
      const ob = big(fh.oldestBlock); if (ob !== null) out.push(q(m, s, 2, 'retrieval', 'What is the oldest block number in this fee history, as a decimal integer?', 'bigint', ob.toString()));
      break;
    }
    case 'eth_getUncleByBlockNumberAndIndex':
    case 'eth_getUncleByBlockHashAndIndex': {
      out.push(q(m, s, 1, 'validity', 'Is there an uncle block at this index? Answer yes or no.', 'boolean', r === null ? 'no' : 'yes'));
      break;
    }
    case 'eth_call': {
      const v = big(r);
      if (v !== null) out.push(q(m, s, 1, 'retrieval', 'Decode the returned value as a single uint256 and give it as a decimal integer.', 'bigint', v.toString()));
      break;
    }
    case 'eth_getCode': {
      const isContract = typeof r === 'string' && r !== '0x' && r.length > 2;
      out.push(q(m, s, 1, 'retrieval', 'Does this address contain contract bytecode? Answer yes or no.', 'boolean', isContract ? 'yes' : 'no'));
      break;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const all: BenchQuestion[] = [];
  let methods = 0;
  for (const method of (await readdir(DATA_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
    methods++;
    const dir = join(DATA_DIR, method);
    for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
      const f = JSON.parse(await readFile(join(dir, file), 'utf8')) as SampleFile;
      all.push(...generateForSample(f));
    }
  }
  await writeFile(OUT, JSON.stringify(all, null, 2) + '\n');
  const byCat = all.reduce<Record<string, number>>((a, x) => ((a[x.category] = (a[x.category] ?? 0) + 1), a), {});
  console.log(`✓ ${all.length} questions across ${methods} methods → data/questions.json`);
  const byCatLine = Object.entries(byCat)
    .map(([k, v]) => k + ' ' + v)
    .join(' · ');
  console.log(`  by category: ${byCatLine}`);
}

// Run as CLI (skip when imported).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error('✗ generate failed:', e instanceof Error ? e.stack : e); process.exit(1); });
}
