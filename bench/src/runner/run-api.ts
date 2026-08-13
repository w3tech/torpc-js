/**
 * API evaluator — answers the exam via a model API as a plain chat completion (NO TOOLS),
 * so results measure format COMPREHENSION, unlike the subscription/sub-agent path where
 * sub-agents can run code to parse payloads. This is the path for the fair public benchmark.
 *
 * CONTEXT OVERFLOW is a first-class, distinct outcome: if the payload exceeds the model's
 * window we record `CONTEXT_OVERFLOW` (not a guess, not UNKNOWN). This is exactly the signal
 * that matters for TORPC — if raw (tier 0) overflows but T2 fits and answers, that's a win.
 *
 * Env:
 *   API_PROVIDER     openai | anthropic            (default: openai)
 *   API_MODEL_LABEL  label to record results under (defaults to the model id)
 *   API_CTX          model context window in tokens (overflow pre-check; default 128000)
 *   API_DELAY_MS     spacing between calls (default 0)
 *   API_MAX_OUTPUT   max output tokens (default 1024)
 *   -- openai-compatible: API_BASE_URL, API_KEY, API_MODEL
 *   -- anthropic:        ANTHROPIC_API_KEY, ANTHROPIC_MODEL  (opt ANTHROPIC_BASE_URL, ANTHROPIC_VERSION)
 *
 * Output: data/answers/<label>/<examId>.json   then:  pnpm score -- --model "<label>"
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { requireEnv } from '../secrets/index.ts';
import { makeTokenizer } from '../tokenizers/index.ts';

const DATA = new URL('../../data/', import.meta.url).pathname;
const EXAM = join(DATA, 'exam');
const OVERFLOW = 'CONTEXT_OVERFLOW';

const SYSTEM = `You are answering questions about blockchain RPC data.
First read the FORMAT note and trust it (e.g. if it says numbers are already decimal, do NOT re-read them as hex; if events are decoded, use the named args).
Answer each question using ONLY the provided DATA. Output just the value asked for
(a decimal number, an address, yes/no) — no explanation, no units unless asked.
If the data simply does not contain the answer, use "UNKNOWN".
Return ONLY a JSON object mapping each question id to its answer string.`;

interface ExamItem { examId: string; payload: string; primer?: string; questions: { qid: string; prompt: string }[]; }

function parseJsonLoose(text: string): Record<string, string> {
  const fenced = text.match(/```(?:json)?([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  const a = body.indexOf('{'), b = body.lastIndexOf('}');
  if (a < 0 || b < 0) return {};
  try {
    const obj = JSON.parse(body.slice(a, b + 1)) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = typeof v === 'string' ? v : JSON.stringify(v);
    return out;
  } catch { return {}; }
}

const isOverflowErr = (s: string) => /context|token|too long|too large|maximum|exceed|prompt is too/i.test(s);

interface CallResult { text?: string; overflow?: boolean; error?: string; retryAfter?: number; }

async function callOpenAI(user: string): Promise<CallResult> {
  const base = requireEnv('API_BASE_URL').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${requireEnv('API_KEY')}` },
    body: JSON.stringify({ model: requireEnv('API_MODEL'), messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }], temperature: 0, max_tokens: Number(process.env.API_MAX_OUTPUT ?? 1024) }),
    signal: AbortSignal.timeout(Number(process.env.API_TIMEOUT_MS ?? 300000)),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 400 && isOverflowErr(t)) return { overflow: true };
    const ra = Number(res.headers.get('retry-after'));
    return { error: `HTTP ${res.status}`, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : undefined };
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { text: j.choices?.[0]?.message?.content ?? '' };
}

async function callAnthropic(user: string): Promise<CallResult> {
  const base = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': requireEnv('ANTHROPIC_API_KEY'), 'anthropic-version': process.env.ANTHROPIC_VERSION ?? '2023-06-01' },
    body: JSON.stringify({ model: requireEnv('ANTHROPIC_MODEL'), max_tokens: Number(process.env.API_MAX_OUTPUT ?? 1024), system: SYSTEM, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(Number(process.env.API_TIMEOUT_MS ?? 300000)),
  });
  if (!res.ok) {
    const t = await res.text();
    if ((res.status === 400 || res.status === 413) && isOverflowErr(t)) return { overflow: true };
    const ra = Number(res.headers.get('retry-after'));
    return { error: `HTTP ${res.status}`, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : undefined };
  }
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  return { text: (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') };
}

async function main(): Promise<void> {
  const provider = (process.env.API_PROVIDER ?? 'openai').toLowerCase();
  const modelId = provider === 'anthropic' ? requireEnv('ANTHROPIC_MODEL') : requireEnv('API_MODEL');
  const label = (process.env.API_MODEL_LABEL ?? modelId).replace(/[^\w.-]/g, '_');
  const ctx = Number(process.env.API_CTX ?? 128000) * 0.85; // leave room for system+question+output
  const delay = Number(process.env.API_DELAY_MS ?? 0);
  const o200k = await makeTokenizer('o200k_base');
  const outDir = join(DATA, 'answers', label);
  await mkdir(outDir, { recursive: true });

  const index = JSON.parse(await readFile(join(EXAM, '_index.json'), 'utf8')) as { examIds: string[] };
  console.log(`API eval: ${index.examIds.length} items · provider=${provider} · model=${modelId} · label=${label} · ctx~${Math.round(ctx)}\n`);

  let done = 0, overflow = 0, errs = 0, skipped = 0;
  for (const examId of index.examIds) {
    // Resume: skip items already answered (non-empty file). An empty {} from a prior failure is retried.
    try {
      const prev = JSON.parse(await readFile(join(outDir, `${examId}.json`), 'utf8')) as Record<string, string>;
      if (prev && Object.keys(prev).length) { done++; skipped++; continue; }
    } catch { /* no prior answer — proceed */ }
    const item = JSON.parse(await readFile(join(EXAM, `${examId}.json`), 'utf8')) as ExamItem;
    let answers: Record<string, string> = {};
    const ptok = o200k.countTokens(item.payload);
    if (ptok > ctx) {
      // Pre-flight overflow: the payload alone exceeds the window — record the distinct signal.
      for (const q of item.questions) answers[q.qid] = OVERFLOW;
      overflow++;
    } else {
      const primer = item.primer ? "FORMAT: " + item.primer + "\n\n" : '';
      const questionList = item.questions.map((q) => "- [" + q.qid + "] " + q.prompt).join('\n');
      const user = `${primer}DATA:\n\`\`\`\n${item.payload}\n\`\`\`\n\nQuestions:\n${questionList}\n\nReturn ONLY JSON: { "qid": "answer", ... }`;
      let parseFailText = '';
      const MAXTRY = 5;
      for (let attempt = 0; attempt < MAXTRY; attempt++) {
        let r: CallResult;
        try {
          r = provider === 'anthropic' ? await callAnthropic(user) : await callOpenAI(user);
        } catch (e) {
          r = { error: `fetch threw: ${e instanceof Error ? e.message : String(e)}` };
        }
        if (r.overflow) {
          for (const q of item.questions) {
            answers[q.qid] = OVERFLOW;
          }
          overflow++;
          break;
        }
        if (r.error) {
          if (attempt < MAXTRY - 1) {
            const wait = r.retryAfter ? (r.retryAfter + 1) * 1000 : 2000 * 2 ** attempt; // honor 429 Retry-After, else exp backoff
            console.warn(`\n  … retry ${examId} in ${Math.round(wait / 1000)}s (${r.error})`);
            await new Promise((s) => setTimeout(s, wait));
            continue;
          }
          errs++; console.warn(`\n  ✗ ${examId}: ${r.error} (gave up after retries — will retry on next resume run)`);
          break;
        }
        answers = parseJsonLoose(r.text ?? '');
        if (Object.keys(answers).length) break; // parsed OK
        parseFailText = r.text ?? ''; // 200 OK but not parseable JSON → retry (model output varies); save raw if it persists
        if (attempt < MAXTRY - 1) { console.warn(`\n  … reparse-retry ${examId} (model returned non-JSON)`); await new Promise((s) => setTimeout(s, 1500 * 2 ** attempt)); }
      }
      if (Object.keys(answers).length === 0 && parseFailText) {
        await writeFile(join(outDir, `${examId}.raw.txt`), parseFailText);
        console.warn(`\n  ⚠ ${examId}: unparseable JSON after retries — saved ${examId}.raw.txt for inspection`);
      }
    }
    await writeFile(join(outDir, `${examId}.json`), JSON.stringify(answers, null, 2) + '\n');
    done++;
    if (done % 10 === 0 || done === index.examIds.length) process.stdout.write(`\r  ${done}/${index.examIds.length} (overflow ${overflow}, errs ${errs})`);
    if (delay) await new Promise((r) => setTimeout(r, delay));
  }
  console.log(`\n✓ data/answers/${label}/ — done ${done}, skipped(resumed) ${skipped}, overflow ${overflow}, errors ${errs}. Now: pnpm score -- --model "${label}"`);
}

main().catch((e: unknown) => { console.error('✗ run-api failed:', e instanceof Error ? e.stack : e); process.exit(1); });
