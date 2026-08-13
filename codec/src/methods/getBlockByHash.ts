/**
 * eth_getBlockByHash / eth_getBlockByNumber (torpc `methods/eth_getBlockByHash.md`).
 *
 * Header fields go through BLOCK_HEADER_FIELDS (exported — eth_getUncleByBlock*
 * reuses it verbatim). In full-transaction mode each tx is reshaped with the
 * eth_getTransactionByHash per-tx transform, then its block-context fields
 * (block, block_hash, block_timestamp) are dropped as duplicates of the header.
 * Withdrawals are reshaped per their own small table.
 */

import { applyForward, applyBackward, type Field } from '../primitives/fields.ts';
import { drop, isPlainObject } from '../primitives/obj.ts';
import { forwardTx, backwardTx } from './transactionByHash.ts';
import type { MethodMapper } from './registry.ts';

export const BLOCK_HEADER_FIELDS: Field[] = [
  { kind: 'rename', std: 'hash', compact: 'block_hash' },
  { kind: 'rename', std: 'parentHash', compact: 'parent_hash' },
  { kind: 'num', std: 'number', compact: 'block' },
  { kind: 'address', key: 'miner' },
  { kind: 'num', std: 'timestamp', compact: 'timestamp' },
  { kind: 'num', std: 'gasUsed', compact: 'gas_used' },
  { kind: 'num', std: 'gasLimit', compact: 'gas_limit' },
  { kind: 'num', std: 'size', compact: 'size' },
  { kind: 'num', std: 'baseFeePerGas', compact: 'base_fee_per_gas' },
  { kind: 'num', std: 'blobGasUsed', compact: 'blob_gas_used' },
  { kind: 'num', std: 'excessBlobGas', compact: 'excess_blob_gas' },
  { kind: 'drop', std: 'difficulty' },
  { kind: 'drop', std: 'nonce' },
  { kind: 'drop', std: 'mixHash' },
  { kind: 'drop', std: 'sha3Uncles' },
  { kind: 'drop', std: 'stateRoot' },
  { kind: 'drop', std: 'transactionsRoot' },
  { kind: 'drop', std: 'receiptsRoot' },
  { kind: 'drop', std: 'withdrawalsRoot' },
  { kind: 'drop', std: 'parentBeaconBlockRoot' },
  { kind: 'drop', std: 'requestsHash' },
  { kind: 'drop', std: 'logsBloom' },
  { kind: 'drop', std: 'extraData' },
];

const WITHDRAWAL_FIELDS: Field[] = [
  { kind: 'num', std: 'index', compact: 'index' },
  { kind: 'num', std: 'validatorIndex', compact: 'validator_index' },
  { kind: 'address', key: 'address' },
  { kind: 'num', std: 'amount', compact: 'amount' },
];

function forwardBlockTx(tx: unknown): unknown {
  const o = forwardTx(tx);
  if (isPlainObject(o)) drop(o, 'block', 'block_hash', 'block_timestamp'); // duplicates of header
  return o;
}

const fwdWithdrawal = (w: unknown): unknown => (isPlainObject(w) ? applyForward(w, WITHDRAWAL_FIELDS) : w);
const bwdWithdrawal = (w: unknown): unknown => (isPlainObject(w) ? applyBackward(w, WITHDRAWAL_FIELDS) : w);

export const getBlockByHash: MethodMapper = {
  methods: ['eth_getBlockByHash', 'eth_getBlockByNumber'],
  forwardResult(result) {
    if (!isPlainObject(result)) return result;
    const out = applyForward(result, BLOCK_HEADER_FIELDS);
    if (Array.isArray(out.transactions)) {
      out.transactions = out.transactions.map((t) => (isPlainObject(t) ? forwardBlockTx(t) : t));
    }
    if (Array.isArray(out.withdrawals)) out.withdrawals = out.withdrawals.map(fwdWithdrawal);
    return out;
  },
  backwardResult(result) {
    if (!isPlainObject(result)) return result;
    const out = applyBackward(result, BLOCK_HEADER_FIELDS);
    if (Array.isArray(out.transactions)) {
      out.transactions = out.transactions.map((t) => (isPlainObject(t) ? backwardTx(t) : t));
    }
    if (Array.isArray(out.withdrawals)) out.withdrawals = out.withdrawals.map(bwdWithdrawal);
    return out;
  },
};
