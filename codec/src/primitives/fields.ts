/**
 * Declarative field-table engine — the shared core of the bidirectional
 * mapper. One `Field[]` table per method mirrors that method's evm-v1 §T1
 * rule table; `applyForward` and `applyBackward` walk the same table in
 * opposite directions, so the two directions cannot drift apart.
 *
 * Each rule operates on a flat top-level field. Structural shapes (log/tx
 * arrays, decoded-field collapse, topic stripping) are handled explicitly by
 * the per-method modules — they don't fit a flat table.
 */

import { hexToDec, decToHex } from './hex.ts';
import { eip55, lower } from './address.ts';
import type { Obj } from './obj.ts';

export type Field =
  /** Rename only; value carried verbatim. */
  | { kind: 'rename'; std: string; compact: string }
  /** Rename + hex⇄decimal-string on the value. */
  | { kind: 'num'; std: string; compact: string }
  /** Same key; EIP-55 forward / lowercase backward. `dropWhenNull` removes a null on forward. */
  | { kind: 'address'; key: string; dropWhenNull?: boolean }
  /** Same key; `"0x1"`⇄`"success"`, `"0x0"`⇄`"failed"`. */
  | { kind: 'status'; key: string }
  /** Dropped on forward; not restorable on backward. */
  | { kind: 'drop'; std: string };

const has = (o: Obj, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Apply the table standard → compact. Returns a shallow copy; input untouched. */
export function applyForward(src: Obj, fields: readonly Field[]): Obj {
  const out: Obj = { ...src };
  for (const f of fields) {
    switch (f.kind) {
      case 'rename':
        if (has(out, f.std)) {
          out[f.compact] = out[f.std];
          if (f.compact !== f.std) delete out[f.std];
        }
        break;
      case 'num': {
        if (!has(out, f.std)) break;
        const v = out[f.std];
        if (v === null) {
          out[f.compact] = null; // pending/absent positions: rename, preserve null
          if (f.compact !== f.std) delete out[f.std];
        } else if (typeof v === 'string') {
          const dec = hexToDec(v);
          if (dec !== null) {
            out[f.compact] = dec;
            if (f.compact !== f.std) delete out[f.std];
          }
        }
        break;
      }
      case 'address': {
        const v = out[f.key];
        if (v === null) {
          if (f.dropWhenNull) delete out[f.key];
        } else if (typeof v === 'string') {
          out[f.key] = eip55(v);
        }
        break;
      }
      case 'status':
        if (out[f.key] === '0x1') out[f.key] = 'success';
        else if (out[f.key] === '0x0') out[f.key] = 'failed';
        break;
      case 'drop':
        delete out[f.std];
        break;
    }
  }
  return out;
}

/** Apply the table compact → standard. Dropped fields stay lost (lossy by design). */
export function applyBackward(src: Obj, fields: readonly Field[]): Obj {
  const out: Obj = { ...src };
  for (const f of fields) {
    switch (f.kind) {
      case 'rename':
        if (has(out, f.compact)) {
          out[f.std] = out[f.compact];
          if (f.compact !== f.std) delete out[f.compact];
        }
        break;
      case 'num': {
        if (!has(out, f.compact)) break;
        const v = out[f.compact];
        if (v === null) {
          out[f.std] = null;
          if (f.compact !== f.std) delete out[f.compact];
        } else if (typeof v === 'string') {
          const hex = decToHex(v);
          if (hex !== null) {
            out[f.std] = hex;
            if (f.compact !== f.std) delete out[f.compact];
          }
        }
        break;
      }
      case 'address': {
        const v = out[f.key];
        if (typeof v === 'string') out[f.key] = lower(v);
        break;
      }
      case 'status':
        if (out[f.key] === 'success') out[f.key] = '0x1';
        else if (out[f.key] === 'failed') out[f.key] = '0x0';
        break;
      case 'drop':
        // not restorable
        break;
    }
  }
  return out;
}
