/**
 * Dispatch layers L2 (per-method, by name) and L3 (batch).
 *
 * Both operate on a full JSON-RPC response object and preserve the envelope
 * verbatim. Error responses, `null` results, and methods with no mapper pass
 * through unchanged. A JSON-RPC response carries no method name, so the caller
 * supplies it.
 */

import { registry } from './methods/index.ts';

export interface JsonRpcResponse {
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: unknown;
  [k: string]: unknown;
}

export interface BatchItem {
  method: string;
  response: unknown;
}

function map(method: string, response: unknown, dir: 'forward' | 'backward'): unknown {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) return response;
  const r = response as JsonRpcResponse;
  if (r.error !== undefined && r.error !== null) return response; // error passthrough
  if (!('result' in r) || r.result === null || r.result === undefined) return response; // null passthrough
  const mapper = registry.get(method);
  if (mapper === undefined) return response; // unsupported method passthrough
  const result = dir === 'forward' ? mapper.forwardResult(r.result) : mapper.backwardResult(r.result);
  return { ...r, result };
}

/** standard JSON-RPC response → compact. */
export function forward(method: string, response: unknown): unknown {
  return map(method, response, 'forward');
}

/** compact JSON-RPC response → standard (mechanical inverse; lossy by design). */
export function backward(method: string, response: unknown): unknown {
  return map(method, response, 'backward');
}

/** Forward a batch; each element routed by its own method. */
export function forwardBatch(items: readonly BatchItem[]): unknown[] {
  return items.map((i) => forward(i.method, i.response));
}

/** Backward a batch; each element routed by its own method. */
export function backwardBatch(items: readonly BatchItem[]): unknown[] {
  return items.map((i) => backward(i.method, i.response));
}
