/**
 * Consolidate all scored models into one cross-model report, BUCKETED by whether
 * the payload fits the model's context window — so we compare like-for-like:
 *   - ALL-FIT      : raw fits the model ctx → pure comprehension comparison (apples-to-apples)
 *   - COMP-ENABLED : raw overflows but T2 fits → compression lets the model answer at all
 *   - TOO-BIG      : even T2 overflows → model too small, neither helps
 * Token-efficiency (model-independent) is reported separately.
 *
 * Output: results/SUMMARY.md   Run: pnpm consolidate
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { coverageOf, type CoverageClass } from '../fixtures/manifest.ts';

const RESULTS = new URL('../../results/', import.meta.url).pathname;
const ACC = RESULTS + 'accuracy/';
const TOKENS = new URL('../../data/tokens.json', import.meta.url).pathname;

// Context windows (tokens) per model label. Edit as models are added.
const CTX: Record<string, number> = {
  'haiku-4.5': 200_000, 'sonnet-4.6': 200_000, 'opus-4.8': 200_000, 'opus-4.8-1m': 1_000_000,
};
const ctxOf = (m: string) => (CTX[m] ?? 200_000) * 0.9;
const FMTS = ['raw', 'T1', 'T2'] as const;

interface Row { qid: string; method: string; sampleId: string; category: string; coverage: CoverageClass; tier: number; format: string; answer: string; correct: boolean; tokens: number; }
const pc = (c: number, t: number) => (t ? `${((100 * c) / t).toFixed(1)}%` : '—');
const acc = (rows: Row[]) => ({ c: rows.filter((r) => r.correct).length, t: rows.length });

async function main(): Promise<void> {
  const files = (await readdir(ACC)).filter((f) => f.endsWith('.json'));
  if (!files.length) { console.log('no scored models in results/accuracy/'); return; }

  const md: string[] = [];
  md.push('# TORPC public benchmark — cross-model SUMMARY\n');
  md.push('Compare **our own tiers** raw / T1 / T2. Accuracy is **bucketed by context fit** so small-model overflow does not get mixed with comprehension.\n');
  md.push('> ⚠️ **Methodology.** Token-efficiency (below / `token-efficiency.md`) is deterministic. Headline accuracy is the **API path** (`*-api` rows / `pnpm eval:api`) — plain chat-completion, **no tools, value-only**, identical for every model; curated write-up in `BENCHMARK.md`. The older **subscription / sub-agent** rows are tool-assisted (sonnet could parse payloads with code) and **not comparable** — kept only as a snapshot. Accuracy measures **raw→T2 within a model**, not a cross-model ranking (single-sample). `CONTEXT_OVERFLOW` is a **capacity** signal, never an accuracy miss.\n');

  // ---- Token efficiency (model-independent) ----
  try {
    const tok = JSON.parse(await readFile(TOKENS, 'utf8')) as Record<string, { t0: { o200k: number }; t1: { o200k: number }; t2: { o200k: number } }>;
    const sum = { t0: 0, t1: 0, t2: 0 }; const byCov: Record<string, { t0: number; t1: number; t2: number }> = {};
    for (const [k, v] of Object.entries(tok)) {
      sum.t0 += v.t0.o200k; sum.t1 += v.t1.o200k; sum.t2 += v.t2.o200k;
      const cov = coverageOf(k.split('__')[0] ?? '');
      (byCov[cov] ??= { t0: 0, t1: 0, t2: 0 }); byCov[cov].t0 += v.t0.o200k; byCov[cov].t1 += v.t1.o200k; byCov[cov].t2 += v.t2.o200k;
    }
    const sv = (a: number, b: number) => (a ? `−${(((a - b) / a) * 100).toFixed(1)}%` : '—');
    md.push('## Token efficiency (o200k, model-independent)\n');
    md.push('| scope | raw | T1 | T2 | T2 vs raw |');
    md.push('|---|--:|--:|--:|--:|');
    for (const cov of ['full_t2', 'partial_t1', 'unsupported']) { const v = byCov[cov]; if (v) md.push(`| ${cov} | ${v.t0.toLocaleString()} | ${v.t1.toLocaleString()} | ${v.t2.toLocaleString()} | ${sv(v.t0, v.t2)} |`); }
    md.push(`| **overall** | ${sum.t0.toLocaleString()} | ${sum.t1.toLocaleString()} | ${sum.t2.toLocaleString()} | **${sv(sum.t0, sum.t2)}** |\n`);
  } catch { md.push('_(token data missing — run `pnpm tokens`)_\n'); }

  // ---- Per-model, bucketed ----
  const models: { model: string; allfit: Record<string, { c: number; t: number }> }[] = [];
  for (const f of files) {
    const j = JSON.parse(await readFile(ACC + f, 'utf8')) as { model: string; rows: Row[] };
    const m = j.model; const ctx = ctxOf(m); const rows = j.rows;
    const byq: Record<string, Record<string, Row>> = {};
    for (const r of rows) {
      byq[r.qid] ??= {};
      byq[r.qid]![r.format] = r;
    }
    const allfit: string[] = [], comp: string[] = [], over: string[] = [];
    for (const q of Object.keys(byq)) {
      const r = byq[q]!.raw;
      const t = byq[q]!.T2;
      if (!r || !t) continue;
      if (r.tokens < ctx) allfit.push(q);
      else if (t.tokens < ctx) comp.push(q);
      else over.push(q);
    }
    const accBucket = (qids: string[], fmt: string) => acc(qids.map((q) => byq[q]![fmt]!).filter(Boolean));
    md.push(`## ${m}  _(ctx ~${(CTX[m] ?? 200_000) / 1000}K)_\n`);
    md.push('| bucket | n | raw | T1 | T2 |');
    md.push('|---|--:|--:|--:|--:|');
    const line = (name: string, qids: string[]) => { const a = (fm: string) => { const x = accBucket(qids, fm); return pc(x.c, x.t); }; md.push(`| ${name} | ${qids.length} | ${a('raw')} | ${a('T1')} | ${a('T2')} |`); };
    line('ALL-FIT (apples-to-apples)', allfit);
    if (comp.length) line('COMP-ENABLED (raw overflows, T2 fits)', comp);
    if (over.length) line('TOO-BIG (even T2 overflows)', over);
    const all = Object.keys(byq);
    line('overall', all);
    const ovf = (fm: string) => rows.filter((r) => r.format === fm && /^CONTEXT_OVERFLOW$/i.test(String(r.answer))).length;
    if (ovf('raw') + ovf('T1') + ovf('T2') > 0) md.push(`| empirical context-overflow | — | ${ovf('raw')} | ${ovf('T1')} | ${ovf('T2')} |`);
    md.push('');
    const af: Record<string, { c: number; t: number }> = {}; for (const fm of FMTS) af[fm] = accBucket(allfit, fm);
    models.push({ model: m, allfit: af });
  }

  // ---- Cross-model matrix on the ALL-FIT bucket (the fair comparison) ----
  md.push('## Cross-model — ALL-FIT bucket (fair comprehension comparison)\n');
  md.push('| model | raw | T1 | T2 |');
  md.push('|---|--:|--:|--:|');
  for (const { model, allfit } of models) md.push(`| ${model} | ${pc(allfit.raw!.c, allfit.raw!.t)} | ${pc(allfit.T1!.c, allfit.T1!.t)} | ${pc(allfit.T2!.c, allfit.T2!.t)} |`);
  md.push('');
  md.push('> Notes: ALL-FIT = questions whose raw payload fits the model context (×0.9). COMP-ENABLED is where compression lets a model answer that raw can\'t fit. TOO-BIG = even T2 exceeds the window (need a bigger-context model or smaller payload).');

  await writeFile(RESULTS + 'SUMMARY.md', md.join('\n') + '\n');
  console.log(`✓ ${files.length} models → results/SUMMARY.md`);
  for (const { model, allfit } of models) console.log(`  ${model} ALL-FIT: raw ${pc(allfit.raw!.c, allfit.raw!.t)} · T1 ${pc(allfit.T1!.c, allfit.T1!.t)} · T2 ${pc(allfit.T2!.c, allfit.T2!.t)}`);
}

main().catch((e: unknown) => { console.error('✗ consolidate failed:', e instanceof Error ? e.stack : e); process.exit(1); });
