/**
 * eth_getBlockReceipts (torpc `methods/eth_getBlockReceipts.md`). `result` is a
 * flat array of receipts, each byte-identical in shape to
 * eth_getTransactionReceipt — so it reuses that module's per-receipt transform.
 */

import { forwardReceipt, backwardReceipt } from './transactionReceipt.ts';
import type { MethodMapper } from './registry.ts';

export const blockReceipts: MethodMapper = {
  methods: ['eth_getBlockReceipts'],
  forwardResult(result) {
    return Array.isArray(result) ? result.map(forwardReceipt) : result;
  },
  backwardResult(result) {
    return Array.isArray(result) ? result.map(backwardReceipt) : result;
  },
};
