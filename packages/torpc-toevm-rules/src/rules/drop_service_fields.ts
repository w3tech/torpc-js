/**
 * Rule `drop_service`: omit fields that are node-internal or redundant for
 * agent consumption.
 *
 * Normative spec: `specs/evm-v1.md` §T1 ("Drop service / dead fields") plus the
 * per-method drop list in `specs/methods/eth_getTransactionReceipt.md` §2.
 *
 * Receipt level, dropped:
 * - `logsBloom`, a 256-byte Bloom filter, fully derivable from `logs`
 * - `cumulativeGasUsed`, block-position gas accounting, not used downstream
 * - `type`, the EIP-2718 envelope type
 *
 * Receipt level, NOT dropped:
 * - `transactionIndex`. The spec renames it to `tx_index` and keeps it: it is a
 *   property of the transaction's place in consensus history and is not
 *   reconstructible from the other fields. This rule therefore leaves it in
 *   place. The rename and the hex-to-decimal encoding are separate steps that
 *   this package does not implement, see README.md.
 *
 * Per log, dropped:
 * - `blockNumber`, `blockHash`, `transactionHash`, duplicated from the receipt
 * - `transactionIndex`, `logIndex`, `blockTimestamp`, block-position and
 *   node-internal bookkeeping
 * - `removed` when `false`. A `removed: true` value is kept verbatim: it only
 *   occurs on reorged log subscriptions, where it is the whole point of the
 *   field. `specs/evm-v1.md` §T1 names the dead field as `removed: false`,
 *   which is the behaviour implemented here.
 *
 * Returns a shallow copy with the listed keys removed. Fields not enumerated
 * above are preserved verbatim (`specs/evm-v1.md` §T1, unknown-field
 * passthrough), including chain-specific receipt extensions.
 */

const RECEIPT_DROP_KEYS = new Set(['logsBloom', 'cumulativeGasUsed', 'type']);

const LOG_DROP_KEYS = new Set([
  'logIndex',
  'transactionHash',
  'blockHash',
  'transactionIndex',
  'blockNumber',
  'blockTimestamp',
]);

export function dropServiceFields(receipt: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(receipt)) {
    if (RECEIPT_DROP_KEYS.has(key)) continue;

    if (key === 'logs' && Array.isArray(value)) {
      out[key] = value.map((log) => (isPlainObject(log) ? dropLogServiceFields(log) : log));
      continue;
    }

    out[key] = value;
  }

  return out;
}

function dropLogServiceFields(log: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(log)) {
    if (LOG_DROP_KEYS.has(key)) continue;
    if (key === 'removed' && value === false) continue;
    out[key] = value;
  }

  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
