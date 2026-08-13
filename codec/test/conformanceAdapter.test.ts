/**
 * scripts/conformance-adapter.ts, driven exactly as the spec repository's
 * conformance runner drives it: one job on stdin, one JSON object on stdout.
 *
 * The regression these pin: the adapter used to report `token_tier: "1"` for
 * every tier-1 job, including methods it has no ruleset for and responses that
 * carry `error`. Both are tier 0 under evm-v1 §Behavior rule 3, and the adapter
 * is the template other implementations copy, so a wrong tier here propagates.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ADAPTER = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'conformance-adapter.ts');

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** Spawn the adapter with `job` on stdin. The flag is a no-op on Node 23+. */
function runAdapter(job: unknown): Promise<Run> {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', ADAPTER], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', rej);
    child.on('close', (code) => res({ code: code ?? -1, stdout, stderr }));
    child.stdin.end(JSON.stringify(job));
  });
}

async function report(tier: number, method: string, raw_response: unknown) {
  const run = await runAdapter({ tier, request: { jsonrpc: '2.0', id: 1, method }, raw_response });
  assert.equal(run.code, 0, `adapter exited ${run.code}\n${run.stderr}`);
  return JSON.parse(run.stdout) as { response: unknown; token_tier: string };
}

test('covered method at tier 1: transformed body, token_tier 1', async () => {
  const out = await report(1, 'eth_blockNumber', env('0x180fcbd'));
  assert.deepEqual(out.response, env('25230525'));
  assert.equal(out.token_tier, '1');
});

test('method with no ruleset: verbatim body, token_tier 0 (Behavior rule 3)', async () => {
  const raw = env('0x000000000000000000000000000000000000000000000000000000000000002a');
  const out = await report(1, 'eth_call', raw);
  assert.deepEqual(out.response, raw); // nothing transformed
  assert.equal(out.token_tier, '0'); // used to claim "1"
});

test('error element: verbatim body, token_tier 0', async () => {
  const raw = { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'boom' } };
  const out = await report(1, 'eth_blockNumber', raw);
  assert.deepEqual(out.response, raw);
  assert.equal(out.token_tier, '0'); // used to claim "1"
});

test('tier 0 job: verbatim body, token_tier 0', async () => {
  const raw = env('0x180fcbd');
  const out = await report(0, 'eth_blockNumber', raw);
  assert.deepEqual(out.response, raw);
  assert.equal(out.token_tier, '0');
});

test('covered method with result null: token_tier 1, body unchanged because there is nothing to do', async () => {
  const out = await report(1, 'eth_getTransactionReceipt', env(null));
  assert.deepEqual(out.response, env(null));
  assert.equal(out.token_tier, '1');
});

test('a tier above what this codec implements is declared unsupported, not answered lower', async () => {
  // The adapter must not answer a tier-2 job at tier 1, and it must not die either: a non-zero exit
  // aborts the whole conformance case, so the tiers this codec DOES implement would go unchecked.
  // It declares the tier unsupported and the runner skips just that expectation.
  const run = await runAdapter({ tier: 2, request: { method: 'eth_blockNumber' }, raw_response: env('0x1') });
  assert.equal(run.code, 0);
  assert.deepEqual(JSON.parse(run.stdout), { unsupported_tier: 2 });
});

test('a job without tier or request.method is rejected, not guessed at', async () => {
  const run = await runAdapter({ request: { method: 'eth_blockNumber' }, raw_response: env('0x1') });
  assert.equal(run.code, 2);
  assert.equal(run.stdout, '');
});
