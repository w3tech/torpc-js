/**
 * Scalar hex-integer methods (torpc `methods/eth_hexInteger.md`). The whole
 * `result` is a single 0x-hex integer; forward decodes it to a decimal string,
 * backward re-encodes. No T2 shape — these have no decodable structure.
 */

import { hexToDec, decToHex } from '../primitives/hex.ts';
import type { MethodMapper } from './registry.ts';

const METHODS = [
  'eth_blockNumber',
  'eth_chainId',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_blobBaseFee',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_estimateGas',
  'eth_getBlockTransactionCountByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_getUncleCountByBlockHash',
  'eth_getUncleCountByBlockNumber',
] as const;

export const hexInteger: MethodMapper = {
  methods: METHODS,
  forwardResult(result) {
    if (typeof result !== 'string') return result;
    const dec = hexToDec(result);
    return dec === null ? result : dec;
  },
  backwardResult(result) {
    if (typeof result !== 'string') return result;
    const hex = decToHex(result);
    return hex === null ? result : hex;
  },
};
