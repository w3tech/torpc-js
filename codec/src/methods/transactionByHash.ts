/**
 * eth_getTransactionByHash + the two ...ByBlock{Hash,Number}AndIndex variants
 * (torpc `methods/eth_getTransactionByHash.md`). Same tx-object shape.
 *
 * forwardTx / backwardTx are exported because eth_getBlockByHash reuses them
 * for each element of a full-transaction `transactions[]`.
 */

import { applyForward, applyBackward, type Field } from '../primitives/fields.ts';
import { isPlainObject, type Obj } from '../primitives/obj.ts';
import { eip55, lower } from '../primitives/address.ts';
import type { MethodMapper } from './registry.ts';

const TX_FIELDS: Field[] = [
  { kind: 'rename', std: 'hash', compact: 'tx' },
  { kind: 'num', std: 'transactionIndex', compact: 'tx_index' },
  { kind: 'num', std: 'blockNumber', compact: 'block' },
  { kind: 'rename', std: 'blockHash', compact: 'block_hash' },
  { kind: 'address', key: 'from' },
  { kind: 'address', key: 'to' }, // null preserved (contract creation)
  { kind: 'num', std: 'nonce', compact: 'nonce' },
  { kind: 'num', std: 'value', compact: 'value' },
  { kind: 'num', std: 'gas', compact: 'gas_limit' },
  { kind: 'num', std: 'gasPrice', compact: 'gas_price' },
  { kind: 'num', std: 'maxFeePerGas', compact: 'max_fee_per_gas' },
  { kind: 'num', std: 'maxPriorityFeePerGas', compact: 'max_priority_fee_per_gas' },
  { kind: 'num', std: 'maxFeePerBlobGas', compact: 'max_fee_per_blob_gas' },
  { kind: 'rename', std: 'blobVersionedHashes', compact: 'blob_versioned_hashes' },
  { kind: 'rename', std: 'authorizationList', compact: 'authorization_list' },
  { kind: 'num', std: 'blockTimestamp', compact: 'block_timestamp' }, // EIP-7642, conditional
  { kind: 'drop', std: 'chainId' },
  { kind: 'drop', std: 'type' },
  { kind: 'drop', std: 'v' },
  { kind: 'drop', std: 'r' },
  { kind: 'drop', std: 's' },
  { kind: 'drop', std: 'yParity' },
];

const fwdAccessEntry = (e: unknown): unknown => {
  if (!isPlainObject(e)) return e;
  const o: Obj = { ...e };
  if (typeof o.address === 'string') o.address = eip55(o.address);
  return o;
};
const bwdAccessEntry = (e: unknown): unknown => {
  if (!isPlainObject(e)) return e;
  const o: Obj = { ...e };
  if (typeof o.address === 'string') o.address = lower(o.address);
  return o;
};

export function forwardTx(tx: unknown): unknown {
  if (!isPlainObject(tx)) return tx;
  const out = applyForward(tx, TX_FIELDS);
  if (Array.isArray(out.accessList)) {
    if (out.accessList.length === 0) delete out.accessList;
    else {
      out.access_list = out.accessList.map(fwdAccessEntry);
      delete out.accessList;
    }
  }
  // drop input on pure-ETH transfer ("0x") or when provider decoded it (function present)
  if ('input' in out && (out.input === '0x' || 'function' in out)) delete out.input;
  return out;
}

export function backwardTx(tx: unknown): unknown {
  if (!isPlainObject(tx)) return tx;
  const out = applyBackward(tx, TX_FIELDS);
  if (Array.isArray(out.access_list)) {
    out.accessList = out.access_list.map(bwdAccessEntry);
    delete out.access_list;
  }
  // function/args/input passed through untouched; dropped fields not restored
  return out;
}

export const transactionByHash: MethodMapper = {
  methods: [
    'eth_getTransactionByHash',
    'eth_getTransactionByBlockHashAndIndex',
    'eth_getTransactionByBlockNumberAndIndex',
  ],
  forwardResult: forwardTx,
  backwardResult: backwardTx,
};
