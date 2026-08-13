/**
 * Build the "exam" the model answers: one item per (sample × tier), each carrying
 * the tier's payload + that sample's questions (WITHOUT ground truth). The model
 * (a Claude subscription session via sub-agents, or an API evaluator) answers each
 * item independently; scoring happens later in score-answers.ts.
 *
 * Output: data/exam/<method>__<sampleId>__t<tier>.json + data/exam/_index.json
 * Run: pnpm exam   (after `pnpm questions`)
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { BenchQuestion } from '../questions/generate.ts';

const DATA = new URL('../../data/', import.meta.url).pathname;
const FIX = join(DATA, 'fixtures');
const EXAM = join(DATA, 'exam');
const TIERS = ['0', '1', '2'] as const;

// Per-tier format primer (TOON-style): tells the model the conventions of THIS format,
// so it won't e.g. assume "RPC == hex" and re-decode an already-decimal value.
const PRIMERS: Record<string, string> = {
  '0': 'Standard Ethereum JSON-RPC. Numeric quantities are HEX (0x-prefixed). Logs are raw: topics[] + data (ERC-20 Transfer = topic0 0xddf2..., topic1=from, topic2=to, data=value).',
  '1': 'TORPC tier-1. Numeric quantities are ALREADY DECIMAL (NOT hex); some field names are compacted.',
  '2': 'TORPC tier-2. Numbers are ALREADY DECIMAL (NOT hex); events/functions are DECODED with named args (e.g. {event:"Transfer", args:{from,to,value}}); field names are compacted.',
};

interface SampleFile { method: string; sampleId: string; tiers: Record<string, { resultBody: string }>; }

async function main(): Promise<void> {
  const questions = JSON.parse(await readFile(join(DATA, 'questions.json'), 'utf8')) as BenchQuestion[];
  const bySample = new Map<string, BenchQuestion[]>();
  for (const q of questions) {
    const k = `${q.method}__${q.sampleId}`;
    (bySample.get(k) ?? bySample.set(k, []).get(k)!).push(q);
  }

  await mkdir(EXAM, { recursive: true });
  const index: string[] = [];
  for (const method of (await readdir(FIX, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
    for (const file of (await readdir(join(FIX, method))).filter((f) => f.endsWith('.json'))) {
      const f = JSON.parse(await readFile(join(FIX, method, file), 'utf8')) as SampleFile;
      const qs = bySample.get(`${f.method}__${f.sampleId}`);
      if (!qs?.length) continue;
      for (const tier of TIERS) {
        const payload = f.tiers[tier]?.resultBody;
        if (!payload) continue;
        const examId = `${f.method}__${f.sampleId}__t${tier}`;
        const item = {
          examId, method: f.method, sampleId: f.sampleId, tier: Number(tier),
          primer: PRIMERS[tier],
          payload,
          questions: qs.map((q) => ({ qid: q.id, prompt: q.prompt })),
        };
        await writeFile(join(EXAM, `${examId}.json`), JSON.stringify(item, null, 2) + '\n');
        index.push(examId);
      }
    }
  }
  await writeFile(join(EXAM, '_index.json'), JSON.stringify({ count: index.length, examIds: index.sort() }, null, 2) + '\n');
  console.log(`✓ ${index.length} exam items → data/exam/  (answer each, write data/answers/<model>/<examId>.json = { qid: answer })`);
}

main().catch((e: unknown) => { console.error('✗ build-exam failed:', e instanceof Error ? e.stack : e); process.exit(1); });
