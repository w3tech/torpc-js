#!/usr/bin/env node --experimental-strip-types
/**
 * Conformance adapter for @torpc/decoder.
 *
 * Implements the TORPC_CMD protocol of the spec repository's conformance
 * runner: read a job on stdin, write the transformed JSON-RPC response on
 * stdout. This is how the reference decoder is checked against the published
 * vectors, and it is the template for an adapter in any other language.
 *
 *   stdin   {"tier": N, "request": {...}, "raw_response": {...}}
 *   stdout  {"response": {...}, "token_tier": "M"}
 *
 * Usage from a checkout that has both repositories side by side:
 *
 *   cd <spec repo>/conformance
 *   TORPC_CMD='node --experimental-strip-types \
 *     ../../torpc-js/codec/scripts/conformance-adapter.ts' npm test
 *
 * Tier handling: this codec is structural only, so it implements tier 1. A job
 * asking for a tier above 1 is reported as unsupported rather than silently answered at a
 * lower tier, since quietly returning less than asked is exactly the failure
 * the response header exists to expose.
 *
 * `token_tier` is the tier that was ACTUALLY applied, which is not always the
 * tier the job asked for. Report the applied tier, never the requested one: a
 * client that reads "1" over an untransformed body parses hex as decimal and
 * reads stripped values as full width, which is the silent corruption the
 * response header exists to prevent.
 */

import { forward, registry } from '../src/index.ts';

/** Highest tier this codec implements. */
const MAX_TIER = 1;

interface Job {
  tier: number;
  request: { method: string };
  raw_response: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The tier actually applied to one response, per evm-v1 §Behavior rule 3 and
 * the "applied tier" definition in §Batched requests. It is 0, and the body is
 * returned verbatim, when:
 *
 *   - the job asked for tier 0;
 *   - this codec carries no ruleset for the method (rule 3);
 *   - the element carries `error` instead of `result`;
 *   - the payload is not a single JSON-RPC response object (this adapter does
 *     not implement batch arrays, so it declares nothing for one).
 *
 * Otherwise the requested tier, capped at MAX_TIER. A covered method whose
 * enumerated field could not be transformed still counts as T1: Behavior rule
 * 2 says a per-field passthrough must not downgrade the whole response. A
 * `result` of `null` also counts as T1, because the ruleset was applied and
 * had nothing to transform; the two cases the spec puts at tier 0 are
 * no-ruleset and error.
 */
function appliedTier(requested: number, method: string, raw: unknown): number {
  if (requested <= 0) return 0;
  if (!registry.has(method)) return 0;
  if (!isObject(raw)) return 0;
  if (raw.error !== undefined && raw.error !== null) return 0;
  if (!('result' in raw)) return 0;
  return Math.min(requested, MAX_TIER);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);

let job: Job;
try {
  job = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Job;
} catch (e) {
  process.stderr.write(`adapter: stdin is not valid JSON: ${(e as Error).message}\n`);
  process.exit(2);
}

if (!Number.isInteger(job?.tier) || typeof job?.request?.method !== 'string') {
  process.stderr.write('adapter: job must carry an integer tier and a request.method string\n');
  process.exit(2);
}

if (job.tier > MAX_TIER) {
  // Not a failure. This codec is structural only, so tiers above MAX_TIER are outside its scope.
  // Declaring them unsupported lets the runner skip that expectation and still check the tiers this
  // implementation does provide, instead of aborting the whole case on a partial implementation.
  process.stdout.write(JSON.stringify({ unsupported_tier: job.tier }));
  process.exit(0);
}


const tier = appliedTier(job.tier, job.request.method, job.raw_response);
const response = tier === 0 ? job.raw_response : forward(job.request.method, job.raw_response);
process.stdout.write(JSON.stringify({ response, token_tier: String(tier) }));
