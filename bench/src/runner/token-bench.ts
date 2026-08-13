/**
 * Token-efficiency benchmark (deterministic, no model).
 * Reads data/fixtures, tokenizes each tier's payload (o200k_base + cl100k_base),
 * reports savings vs raw (tier 0), grouped by coverage class.
 *
 * Outputs: results/token-efficiency.md (human) + data/tokens.json (for the composite metric in scoring).
 * Run: pnpm tokens
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makeTokenizer } from '../tokenizers/index.ts';
import { coverageOf, type CoverageClass } from '../fixtures/manifest.ts';

const DATA_DIR = new URL('../../data/fixtures/', import.meta.url).pathname;
const RESULTS_DIR = new URL('../../results/', import.meta.url).pathname;
const TOKENS_JSON = new URL('../../data/tokens.json', import.meta.url).pathname;

interface SampleFile {
  method: string;
  sampleId: string;
  description: string;
  tiers: Record<string, { resultBody: string }>;
  rawExt?: { resultBody: string };
}
interface Row {
  method: string; sampleId: string; coverage: CoverageClass;
  t0: number; t1: number; t2: number; extDelta: number | null;
}

const pct = (from: number, to: number) => (from > 0 ? `${(((from - to) / from) * 100).toFixed(1)}%` : '—');

async function main(): Promise<void> {
  const o200k = await makeTokenizer('o200k_base');
  const cl100k = await makeTokenizer('cl100k_base');
  const rows: Row[] = [];
  const tokensJson: Record<string, { t0: { o200k: number; cl100k: number }; t1: { o200k: number; cl100k: number }; t2: { o200k: number; cl100k: number } }> = {};

  const methods = (await readdir(DATA_DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const method of methods) {
    for (const file of (await readdir(join(DATA_DIR, method))).filter((f) => f.endsWith('.json'))) {
      const f = JSON.parse(await readFile(join(DATA_DIR, method, file), 'utf8')) as SampleFile;
      const b0 = f.tiers['0']?.resultBody ?? '';
      const b1 = f.tiers['1']?.resultBody ?? b0;
      const b2 = f.tiers['2']?.resultBody ?? b1;
      const t0 = o200k.countTokens(b0), t1 = o200k.countTokens(b1), t2 = o200k.countTokens(b2);
      const key = `${method}__${f.sampleId}`;
      tokensJson[key] = {
        t0: { o200k: t0, cl100k: cl100k.countTokens(b0) },
        t1: { o200k: t1, cl100k: cl100k.countTokens(b1) },
        t2: { o200k: t2, cl100k: cl100k.countTokens(b2) },
      };
      const extDelta = f.rawExt && !f.rawExt.resultBody.startsWith('ERROR') ? o200k.countTokens(f.rawExt.resultBody) - t0 : null;
      rows.push({ method, sampleId: f.sampleId, coverage: coverageOf(method), t0, t1, t2, extDelta });
    }
  }

  rows.sort((a, b) => a.coverage.localeCompare(b.coverage) || a.method.localeCompare(b.method) || a.sampleId.localeCompare(b.sampleId));

  const md: string[] = [];
  md.push('# TORPC public benchmark — token efficiency (raw / T1 / T2)\n');
  md.push('Tokens via `gpt-tokenizer` `o200k_base`, measured on the `result` payload the agent consumes. Savings shown vs **raw (tier 0)**. Captured from the production proxy with `Accept-Token-Tier: 0|1|2`.\n');

  const groups: { cls: CoverageClass; title: string }[] = [
    { cls: 'full_t2', title: 'FULL T2 (ABI-decoded) — where compression matters most' },
    { cls: 'partial_t1', title: 'PARTIAL T1 (hex→dec only; T2 == T1 expected)' },
    { cls: 'unsupported', title: 'UNSUPPORTED (raw-only baseline; raw == T1 == T2 expected)' },
  ];
  const agg: Record<string, { t0: number; t1: number; t2: number }> = {};
  for (const g of groups) {
    const grp = rows.filter((r) => r.coverage === g.cls);
    if (!grp.length) continue;
    md.push(`## ${g.title}\n`);
    md.push('| method | sample | raw tok | T1 tok | T1 Δ | T2 tok | T2 Δ |');
    md.push('|---|---|---:|---:|---:|---:|---:|');
    const sum = { t0: 0, t1: 0, t2: 0 };
    for (const r of grp) {
      md.push(`| \`${r.method}\` | ${r.sampleId} | ${r.t0.toLocaleString()} | ${r.t1.toLocaleString()} | ${pct(r.t0, r.t1)} | ${r.t2.toLocaleString()} | ${pct(r.t0, r.t2)} |`);
      sum.t0 += r.t0; sum.t1 += r.t1; sum.t2 += r.t2;
    }
    agg[g.cls] = sum;
    md.push(`| **subtotal** | | **${sum.t0.toLocaleString()}** | **${sum.t1.toLocaleString()}** | **${pct(sum.t0, sum.t1)}** | **${sum.t2.toLocaleString()}** | **${pct(sum.t0, sum.t2)}** |\n`);
  }
  const all = rows.reduce((a, r) => ({ t0: a.t0 + r.t0, t1: a.t1 + r.t1, t2: a.t2 + r.t2 }), { t0: 0, t1: 0, t2: 0 });
  md.push(`## Overall\n`);
  md.push('| | raw | T1 | T2 |');
  md.push('|---|---:|---:|---:|');
  md.push(`| tokens | ${all.t0.toLocaleString()} | ${all.t1.toLocaleString()} | ${all.t2.toLocaleString()} |`);
  md.push(`| savings vs raw | — | ${pct(all.t0, all.t1)} | ${pct(all.t0, all.t2)} |`);
  const extRows = rows.filter((r) => r.extDelta !== null);
  if (extRows.length) md.push(`\n_External-raw sanity: ${extRows.length} samples had an external raw baseline; tier-0 vs external token delta should be ~0 (same JSON-RPC)._`);

  // TOON-style bar chart (o200k tokens; bar length ∝ tokens vs raw baseline)
  const chart: string[] = [];
  const bar = (frac: number) => '█'.repeat(Math.max(1, Math.round(frac * 42)));
  const block = (title: string, v: { t0: number; t1: number; t2: number }) => {
    chart.push(title);
    chart.push(`  raw  ${bar(1)} ${v.t0.toLocaleString().padStart(11)}  baseline`);
    chart.push(`  T1   ${bar(v.t1 / v.t0)} ${v.t1.toLocaleString().padStart(11)}  ${pct(v.t0, v.t1)} smaller`);
    chart.push(`  T2   ${bar(v.t2 / v.t0)} ${v.t2.toLocaleString().padStart(11)}  ${pct(v.t0, v.t2)} smaller`);
    chart.push('');
  };
  block('OVERALL', all);
  if (agg['full_t2']) block('FULL-T2 methods (receipts / logs / blocks / txs)', agg['full_t2']);
  if (agg['partial_t1']) block('PARTIAL-T1 methods (hex scalars)', agg['partial_t1']);
  md.push('\n## Token efficiency — chart (TOON-style)\n');
  md.push('```\n' + chart.join('\n') + '```');
  console.log('\n' + chart.join('\n'));

  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(join(RESULTS_DIR, 'token-efficiency.md'), md.join('\n') + '\n');
  await writeFile(TOKENS_JSON, JSON.stringify(tokensJson, null, 2) + '\n');
  console.log(`✓ ${rows.length} samples · overall T2 savings ${pct(all.t0, all.t2)} (o200k)`);
  console.log(`✓ wrote results/token-efficiency.md + data/tokens.json`);
}

main().catch((e: unknown) => { console.error('✗ token-bench failed:', e instanceof Error ? e.stack : e); process.exit(1); });
