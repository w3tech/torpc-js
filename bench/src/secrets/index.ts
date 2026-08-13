import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Secrets resolution order:
 *   1. Already-set process env (e.g. ANKR_RPC_KEY exported in your shell), preferred, no file.
 *   2. A LOCAL secrets file OUTSIDE the repo, loaded only if present (never committed).
 * The key never lives in the repo.
 */
const SECRETS_PATHS = [
  process.env.AGENT_RPC_BENCH_ENV,
  join(homedir(), '.config', 'agent-rpc-bench', 'secrets.env'),
  join(homedir(), '.config', 'agent-rpc-bench.env'),
].filter((p): p is string => !!p);

let loaded = false;

/** Best-effort: load any local secrets file that exists. Does NOT throw if none — env vars may already be set. */
export function loadSecrets(): void {
  if (loaded) return;
  for (const p of SECRETS_PATHS) {
    if (existsSync(p)) config({ path: p, quiet: true });
  }
  loaded = true;
}

export function requireEnv(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  loadSecrets();
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Required env var ${name} is not set. Set it in your environment ` +
        `or in a local secrets file (${SECRETS_PATHS[SECRETS_PATHS.length - 1]}).`,
    );
  }
  return v;
}

/**
 * Redacted URL safe for logging — strips key-looking PATH segments (e.g. rpc.ankr.com/eth/<KEY>)
 * AND secret query params (e.g. ?apikey=<KEY>).
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').map((seg) =>
      /^[a-f0-9]{24,}$/i.test(seg) || /^[A-Za-z0-9_-]{40,}$/.test(seg) ? '<KEY>' : seg,
    );
    for (const k of ['apikey', 'apiKey', 'key', 'token']) {
      if (u.searchParams.has(k)) u.searchParams.set(k, '<KEY>');
    }
    const q = u.searchParams.toString();
    const query = q ? '?' + q : '';
    return `${u.protocol}//${u.host}${segments.join('/')}${query}`;
  } catch {
    return '<unparseable-url>';
  }
}
