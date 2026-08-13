/**
 * Score a model's answers (data/answers/<model>/<examId>.json) against the
 * generated ground truth (data/questions.json), per tier/format (raw / T1 / T2),
 * with the composite efficiency metric (accuracy ÷ tokens × 1000) from data/tokens.json.
 *
 * Outputs: results/accuracy/<model>.json (raw rows) + results/retrieval-accuracy.md (rendered).
 * Run: pnpm score -- --model "<model-name>"
 */
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { score, type AnswerType } from '../scorer/index.ts';
import { coverageOf, type CoverageClass } from '../fixtures/manifest.ts';

const DATA = new URL('../../data/', import.meta.url).pathname;
const RESULTS = new URL('../../results/', import.meta.url).pathname;
const TIERS = [0, 1, 2] as const;
const FMT: Record<number, string> = { 0: 'raw', 1: 'T1', 2: 'T2' };

interface BenchQuestion { id: string; method: string; sampleId: string; category: string; prompt: string; answerType: AnswerType; expected: string[]; }
type TokRec = Record<string, { t0: { o200k: number }; t1: { o200k: number }; t2: { o200k: number } }>;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const exists = async (p: string) => { try { await access(p); return true; } catch { return false; } };
const pct = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`);

async function main(): Promise<void> {
  const model = arg('model') ?? process.env.MODEL ?? 'unknown-model';
  const answersDir = join(DATA, 'answers', model);
  if (!(await exists(answersDir))) throw new Error(`No answers dir: ${answersDir}. Answer the exam first (see bench/README.md).`);

  const questions = JSON.parse(await readFile(join(DATA, 'questions.json'), 'utf8')) as BenchQuestion[];
  const tokens = JSON.parse(await readFile(join(DATA, 'tokens.json'), 'utf8')) as TokRec;

  // Load all answer files: examId -> { qid: answer }
  const answers = new Map<string, Record<string, string>>();
  for (const file of (await readdir(answersDir)).filter((f) => f.endsWith('.json'))) {
    answers.set(file.replace(/\.json$/, ''), JSON.parse(await readFile(join(answersDir, file), 'utf8')));
  }

  interface Row { qid: string; method: string; sampleId: string; category: string; coverage: CoverageClass; tier: number; format: string; answer: string; correct: boolean; tokens: number; }
  const rows: Row[] = [];
  for (const q of questions) {
    const sampleKey = `${q.method}__${q.sampleId}`;
    const tok = tokens[sampleKey];
    for (const tier of TIERS) {
      const examId = `${sampleKey}__t${tier}`;
      const rawAnswer = answers.get(examId)?.[q.id] ?? '';
      const a = typeof rawAnswer === 'string' ? rawAnswer : String(rawAnswer);
      const verdict = score({ llmAnswer: a, expected: q.expected, type: q.answerType });
      const perTier = tok ? [tok.t0.o200k, tok.t1.o200k, tok.t2.o200k] : [0, 0, 0];
      const tcount = perTier[tier] ?? 0;
      rows.push({ qid: q.id, method: q.method, sampleId: q.sampleId, category: q.category, coverage: coverageOf(q.method), tier, format: FMT[tier]!, answer: a, correct: verdict.correct, tokens: tcount });
    }
  }

  // Aggregations
  const acc = (rs: Row[]) => ({ correct: rs.filter((r) => r.correct).length, total: rs.length });
  const formats = ['raw', 'T1', 'T2'];
  const cats = ['retrieval', 'aggregation', 'filtering', 'structure', 'validity', 'decoding'];
  const covs: CoverageClass[] = ['full_t2', 'partial_t1', 'unsupported'];

  const md: string[] = [];
  md.push(`# TORPC public benchmark — retrieval accuracy\n`);
  md.push(`Model: \`${model}\` · ${questions.length} questions × 3 formats = ${rows.length} evaluations · deterministic type-aware scoring (no LLM judge).\n`);

  const isOverflow = (s: string) => /^CONTEXT_OVERFLOW$/i.test(String(s).trim());
  md.push(`## Overall (accuracy + composite efficiency)\n`);
  md.push('| format | accuracy | context-overflow | avg tokens (o200k) | efficiency (acc%/1K tok) |');
  md.push('|---|---:|---:|---:|---:|');
  for (const fmt of formats) {
    const rs = rows.filter((r) => r.format === fmt);
    const a = acc(rs);
    const ov = rs.filter((r) => isOverflow(r.answer)).length;
    const avgTok = rs.length ? rs.reduce((s, r) => s + r.tokens, 0) / rs.length : 0;
    const eff = avgTok > 0 ? ((a.correct / a.total) * 100) / (avgTok / 1000) : 0;
    md.push(`| ${fmt} | ${a.correct}/${a.total} (${pct(a.correct, a.total)}) | ${ov} | ${Math.round(avgTok).toLocaleString()} | ${eff.toFixed(1)} |`);
  }

  md.push(`\n## Accuracy by question category\n`);
  md.push('| category | raw | T1 | T2 |');
  md.push('|---|---:|---:|---:|');
  for (const c of cats) {
    const cells = formats.map((fmt) => { const a = acc(rows.filter((r) => r.format === fmt && r.category === c)); return a.total ? `${pct(a.correct, a.total)}` : '—'; });
    md.push(`| ${c} | ${cells.join(' | ')} |`);
  }

  md.push(`\n## Accuracy by coverage class\n`);
  md.push('| coverage | raw | T1 | T2 |');
  md.push('|---|---:|---:|---:|');
  for (const cov of covs) {
    const cells = formats.map((fmt) => { const a = acc(rows.filter((r) => r.format === fmt && r.coverage === cov)); return a.total ? `${a.correct}/${a.total} (${pct(a.correct, a.total)})` : '—'; });
    md.push(`| ${cov} | ${cells.join(' | ')} |`);
  }

  await mkdir(join(RESULTS, 'accuracy'), { recursive: true });
  await writeFile(join(RESULTS, 'accuracy', `${model.replace(/[^\w.-]/g, '_')}.json`), JSON.stringify({ model, generatedFrom: 'data/questions.json', rows }, null, 2) + '\n');
  await writeFile(join(RESULTS, 'retrieval-accuracy.md'), md.join('\n') + '\n');

  const overall = acc(rows);
  console.log(`✓ ${model}: overall ${pct(overall.correct, overall.total)} · wrote results/accuracy/${model}.json + results/retrieval-accuracy.md`);
}

main().catch((e: unknown) => { console.error('✗ score-answers failed:', e instanceof Error ? e.stack : e); process.exit(1); });
