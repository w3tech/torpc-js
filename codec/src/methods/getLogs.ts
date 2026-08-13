/**
 * eth_getLogs (torpc `methods/eth_getLogs.md`). `result` is a flat `Log[]`.
 *
 * Unlike receipt logs, the per-log block/tx/position fields are load-bearing
 * (logs span multiple blocks and txs), so they are renamed and kept rather
 * than dropped. The event-shape part is shared with eth_getTransactionReceipt.
 */

import { applyForward, applyBackward, type Field } from '../primitives/fields.ts';
import { isPlainObject, type Obj } from '../primitives/obj.ts';
import { forwardLogEventPart, backwardLogEventPart } from './transactionReceipt.ts';
import type { MethodMapper } from './registry.ts';

const POSITION_FIELDS: Field[] = [
  { kind: 'num', std: 'blockNumber', compact: 'block' },
  { kind: 'rename', std: 'blockHash', compact: 'block_hash' },
  { kind: 'rename', std: 'transactionHash', compact: 'tx' },
  { kind: 'num', std: 'transactionIndex', compact: 'tx_index' },
  { kind: 'num', std: 'logIndex', compact: 'log_index' },
  { kind: 'num', std: 'blockTimestamp', compact: 'block_timestamp' }, // EIP-7642, conditional
];

function forwardLog(log: unknown): unknown {
  if (!isPlainObject(log)) return log;
  const out: Obj = { ...log };
  forwardLogEventPart(out);
  if (out.removed === false) delete out.removed; // removed:true kept verbatim
  return applyForward(out, POSITION_FIELDS);
}

function backwardLog(log: unknown): unknown {
  if (!isPlainObject(log)) return log;
  const out: Obj = { ...log };
  backwardLogEventPart(out);
  return applyBackward(out, POSITION_FIELDS);
}

export const getLogs: MethodMapper = {
  methods: ['eth_getLogs'],
  forwardResult(result) {
    if (!Array.isArray(result)) return result;
    return result.map(forwardLog);
  },
  backwardResult(result) {
    if (!Array.isArray(result)) return result;
    return result.map(backwardLog);
  },
};
