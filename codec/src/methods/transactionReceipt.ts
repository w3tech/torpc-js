/**
 * eth_getTransactionReceipt (torpc `methods/eth_getTransactionReceipt.md`).
 *
 * Receipt-level fields go through the shared field table. Each log goes
 * through the shared event-shape part (exported for getLogs / blockReceipts
 * reuse) plus a receipt-specific drop of the per-log position fields that are
 * redundant with the receipt level. Those dropped fields are NOT restored on
 * backward (design spec §6) — backward is a flat per-object inverse.
 */

import { applyForward, applyBackward, type Field } from '../primitives/fields.ts';
import { rename, drop, isPlainObject, type Obj } from '../primitives/obj.ts';
import { eip55, lower } from '../primitives/address.ts';
import { stripZeroBlock, padZeroBlock } from '../primitives/topic.ts';
import type { MethodMapper } from './registry.ts';

const RECEIPT_FIELDS: Field[] = [
  { kind: 'rename', std: 'transactionHash', compact: 'tx' },
  { kind: 'num', std: 'transactionIndex', compact: 'tx_index' },
  { kind: 'num', std: 'blockNumber', compact: 'block' },
  { kind: 'rename', std: 'blockHash', compact: 'block_hash' },
  { kind: 'address', key: 'from' },
  { kind: 'address', key: 'to' },
  { kind: 'address', key: 'contractAddress', dropWhenNull: true },
  { kind: 'status', key: 'status' },
  { kind: 'num', std: 'gasUsed', compact: 'gas_used' },
  { kind: 'num', std: 'effectiveGasPrice', compact: 'gas_price' },
  { kind: 'drop', std: 'cumulativeGasUsed' },
  { kind: 'drop', std: 'type' },
  { kind: 'drop', std: 'logsBloom' },
];

/**
 * Forward the event-shape portion of a log (shared by every log-bearing
 * method): EIP-55 the address, strip indexed-topic padding, and — if the
 * provider already decoded the log (`event` present) — collapse to the
 * decoded shape, dropping the now-redundant raw `topics`/`data`.
 */
export function forwardLogEventPart(out: Obj): void {
  if (typeof out.address === 'string') out.address = eip55(out.address);
  if (Array.isArray(out.topics)) {
    out.topics = out.topics.map((t, i) => (i >= 1 && typeof t === 'string' ? stripZeroBlock(t) : t));
  }
  if ('event' in out) {
    rename(out, 'address', 'contract');
    drop(out, 'topics', 'data');
  }
}

/** Inverse of forwardLogEventPart. Decoded fields are left untouched; raw
 *  `topics`/`data` of a collapsed log are NOT reconstructed (lossy by design). */
export function backwardLogEventPart(out: Obj): void {
  if ('contract' in out) rename(out, 'contract', 'address');
  if (typeof out.address === 'string') out.address = lower(out.address);
  if (Array.isArray(out.topics)) {
    out.topics = out.topics.map((t, i) => (i >= 1 && typeof t === 'string' ? padZeroBlock(t) : t));
  }
}

function forwardReceiptLog(log: unknown): unknown {
  if (!isPlainObject(log)) return log;
  const out: Obj = { ...log };
  forwardLogEventPart(out);
  // `removed` is an unconditional drop here, per the per-log table in
  // methods/eth_getTransactionReceipt.md: a receipt is only returned for a
  // mined transaction, so the flag is always false. eth_getLogs is the method
  // that keeps `removed: true`, and it has its own rule for that.
  drop(out, 'blockNumber', 'transactionHash', 'blockHash', 'transactionIndex', 'blockTimestamp', 'logIndex', 'removed');
  return out;
}

function backwardReceiptLog(log: unknown): unknown {
  if (!isPlainObject(log)) return log;
  const out: Obj = { ...log };
  backwardLogEventPart(out);
  return out;
}

/** Forward a single receipt object (reused by eth_getBlockReceipts). */
export function forwardReceipt(receipt: unknown): unknown {
  if (!isPlainObject(receipt)) return receipt;
  const out = applyForward(receipt, RECEIPT_FIELDS);
  if (Array.isArray(out.logs)) out.logs = out.logs.map(forwardReceiptLog);
  return out;
}

/** Backward a single receipt object (reused by eth_getBlockReceipts). */
export function backwardReceipt(receipt: unknown): unknown {
  if (!isPlainObject(receipt)) return receipt;
  const out = applyBackward(receipt, RECEIPT_FIELDS);
  if (Array.isArray(out.logs)) out.logs = out.logs.map(backwardReceiptLog);
  return out;
}

export const transactionReceipt: MethodMapper = {
  methods: ['eth_getTransactionReceipt'],
  forwardResult: forwardReceipt,
  backwardResult: backwardReceipt,
};
