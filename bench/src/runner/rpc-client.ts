/**
 * Minimal JSON-RPC client for ETH JSON-RPC and Ankr AAPI.
 * Adds retry on transient failures and URL redaction in error messages.
 */
import { redactUrl } from '../secrets/index.ts';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown;
  id: number;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export interface RpcOptions {
  retries?: number;
  /** Backoff base in ms — actual wait = base * 2^attempt. */
  backoffMs?: number;
  timeoutMs?: number;
}

const DEFAULTS: Required<RpcOptions> = {
  retries: 3,
  backoffMs: 500,
  timeoutMs: 60_000,
};

let nextId = 1;

export async function jsonRpc<T>(url: string, method: string, params: unknown, opts: RpcOptions = {}): Promise<T> {
  const o = { ...DEFAULTS, ...opts };
  const body: JsonRpcRequest = { jsonrpc: '2.0', method, params, id: nextId++ };

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= o.retries; attempt++) {
    if (attempt > 0) {
      const wait = o.backoffMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, wait));
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), o.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        // 429 / 5xx retryable; 4xx other = throw immediately
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status} from ${redactUrl(url)} for ${method}`);
          continue;
        }
        throw new Error(`HTTP ${res.status} from ${redactUrl(url)} for ${method}`);
      }
      const json = (await res.json()) as JsonRpcResponse<T>;
      if (json.error) {
        // RPC errors may also be transient — retry on rate-limit/server signals.
        if (json.error.code === -32603 || json.error.message?.toLowerCase().includes('rate')) {
          lastErr = new Error(`RPC error ${json.error.code}: ${json.error.message} (${method})`);
          continue;
        }
        throw new Error(`RPC error ${json.error.code}: ${json.error.message} (${method})`);
      }
      if (json.result === undefined) {
        throw new Error(`RPC returned no result for ${method}`);
      }
      return json.result;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        lastErr = new Error(`Timeout after ${o.timeoutMs}ms for ${method}`);
        continue;
      }
      // network errors are retryable
      if (err instanceof TypeError) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error(`Unknown error calling ${method}`);
}

/** Hex-string to bigint helper. */
export function hexToBig(hex: string): bigint {
  return BigInt(hex);
}

/** bigint to 0x-hex string. */
export function bigToHex(n: bigint): `0x${string}` {
  return `0x${n.toString(16)}`;
}

/**
 * Result of one tier-aware capture: the proxy is hit with `Accept-Token-Tier: <tier>`
 * and we keep both the payload the agent would consume (`result`) and the echoed
 * `Token-Tier` response header (so we can verify the tier actually applied).
 */
export interface TierCapture {
  status: number;
  /** Echoed `Token-Tier` response header (null if the endpoint doesn't speak TORPC). */
  tokenTier: string | null;
  /** `json.result` — the body the agent consumes. */
  result: unknown;
  /** Compact JSON of `result` — what we feed the model / tokenize. */
  resultBody: string;
  error?: { code: number; message: string };
}

/**
 * Same transport as jsonRpc() but sets the TORPC tier header and returns the
 * `result` payload + the echoed Token-Tier header. Used by capture-tiers to grab
 * raw (0) / T1 (1) / T2 (2) of the SAME request from our production proxy.
 */
export async function captureTier(
  url: string,
  method: string,
  params: unknown,
  tier: 0 | 1 | 2,
  opts: RpcOptions = {},
): Promise<TierCapture> {
  const o = { ...DEFAULTS, ...opts };
  const reqBody = JSON.stringify({ jsonrpc: '2.0', method, params, id: nextId++ });
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= o.retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, o.backoffMs * Math.pow(2, attempt - 1)));
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), o.timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Token-Tier': String(tier) },
        body: reqBody,
        signal: ac.signal,
      });
      clearTimeout(timer);
      const tokenTier = res.headers.get('Token-Tier');
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`HTTP ${res.status} from ${redactUrl(url)} for ${method} tier${tier}`);
          continue;
        }
        throw new Error(`HTTP ${res.status} from ${redactUrl(url)} for ${method} tier${tier}`);
      }
      const json = (await res.json()) as JsonRpcResponse;
      if (json.error) {
        if (json.error.code === -32603 || (json.error.message ?? '').toLowerCase().includes('rate')) {
          lastErr = new Error(`RPC error ${json.error.code}: ${json.error.message} (${method})`);
          continue;
        }
        return { status: res.status, tokenTier, result: null, resultBody: '', error: { code: json.error.code, message: json.error.message } };
      }
      return { status: res.status, tokenTier, result: json.result, resultBody: JSON.stringify(json.result) };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        lastErr = new Error(`Timeout after ${o.timeoutMs}ms for ${method} tier${tier}`);
        continue;
      }
      if (err instanceof TypeError) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error(`captureTier failed for ${method} tier${tier}`);
}
