import type { MethodMapper } from './registry.ts';
import { hexInteger } from './hexInteger.ts';
import { transactionReceipt } from './transactionReceipt.ts';
import { getLogs } from './getLogs.ts';
import { transactionByHash } from './transactionByHash.ts';
import { getBlockByHash } from './getBlockByHash.ts';
import { uncle } from './uncle.ts';
import { blockReceipts } from './blockReceipts.ts';
import { feeHistory } from './feeHistory.ts';

const ALL: readonly MethodMapper[] = [
  hexInteger,
  transactionReceipt,
  getLogs,
  transactionByHash,
  getBlockByHash,
  uncle,
  blockReceipts,
  feeHistory,
];

export const registry: ReadonlyMap<string, MethodMapper> = (() => {
  const m = new Map<string, MethodMapper>();
  for (const mapper of ALL) {
    for (const name of mapper.methods) m.set(name, mapper);
  }
  return m;
})();

export type { MethodMapper };
