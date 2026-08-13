/**
 * eth_feeHistory (torpc `methods/eth_feeHistory.md`). T1 only — parallel numeric
 * arrays plus a single anchor. hex⇄dec on the base-fee arrays, the `oldest_block`
 * anchor, and every entry of the 2D `reward` array; the ratio arrays are JSON
 * floats and pass through verbatim (renamed only).
 */

import { hexToDec, decToHex } from '../primitives/hex.ts';
import { rename, isPlainObject, type Obj } from '../primitives/obj.ts';
import type { MethodMapper } from './registry.ts';

const has = (o: Obj, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const mapHex = (v: unknown, conv: (s: string) => string | null): unknown =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? (conv(x) ?? x) : x)) : v;

/** Rename an array field and hex⇄dec each element. */
function renameArr(o: Obj, from: string, to: string, conv: (s: string) => string | null): void {
  if (!has(o, from)) return;
  o[to] = mapHex(o[from], conv);
  if (from !== to) delete o[from];
}

/** hex⇄dec a scalar field with rename (the oldest_block anchor). */
function renameScalar(o: Obj, from: string, to: string, conv: (s: string) => string | null): void {
  if (!has(o, from)) return;
  const v = o[from];
  o[to] = typeof v === 'string' ? (conv(v) ?? v) : v;
  if (from !== to) delete o[from];
}

function map(result: unknown, conv: (s: string) => string | null, anchor: [string, string], pairs: [string, string][], ratios: [string, string][]): unknown {
  if (!isPlainObject(result)) return result;
  const out: Obj = { ...result };
  renameScalar(out, anchor[0], anchor[1], conv);
  for (const [from, to] of pairs) renameArr(out, from, to, conv);
  for (const [from, to] of ratios) rename(out, from, to); // verbatim floats
  if (Array.isArray(out.reward)) out.reward = out.reward.map((inner) => mapHex(inner, conv)); // 2D, name unchanged
  return out;
}

const FWD_PAIRS: [string, string][] = [
  ['baseFeePerGas', 'base_fee_per_gas'],
  ['baseFeePerBlobGas', 'base_fee_per_blob_gas'],
];
const FWD_RATIOS: [string, string][] = [
  ['gasUsedRatio', 'gas_used_ratio'],
  ['blobGasUsedRatio', 'blob_gas_used_ratio'],
];
const BWD_PAIRS: [string, string][] = FWD_PAIRS.map(([a, b]) => [b, a]);
const BWD_RATIOS: [string, string][] = FWD_RATIOS.map(([a, b]) => [b, a]);

export const feeHistory: MethodMapper = {
  methods: ['eth_feeHistory'],
  forwardResult(result) {
    return map(result, hexToDec, ['oldestBlock', 'oldest_block'], FWD_PAIRS, FWD_RATIOS);
  },
  backwardResult(result) {
    return map(result, decToHex, ['oldest_block', 'oldestBlock'], BWD_PAIRS, BWD_RATIOS);
  },
};
