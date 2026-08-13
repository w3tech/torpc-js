/**
 * eth_getUncleByBlockHashAndIndex / eth_getUncleByBlockNumberAndIndex
 * (torpc `methods/eth_getUncleByBlockHashAndIndex.md`).
 *
 * An uncle is a header-only subset of a block (no transactions, no withdrawals,
 * no post-merge fields), so it reuses the block-header field table verbatim.
 * `uncles: []` (always empty) passes through untouched.
 */

import { applyForward, applyBackward } from '../primitives/fields.ts';
import { isPlainObject } from '../primitives/obj.ts';
import { BLOCK_HEADER_FIELDS } from './getBlockByHash.ts';
import type { MethodMapper } from './registry.ts';

export const uncle: MethodMapper = {
  methods: ['eth_getUncleByBlockHashAndIndex', 'eth_getUncleByBlockNumberAndIndex'],
  forwardResult(result) {
    return isPlainObject(result) ? applyForward(result, BLOCK_HEADER_FIELDS) : result;
  },
  backwardResult(result) {
    return isPlainObject(result) ? applyBackward(result, BLOCK_HEADER_FIELDS) : result;
  },
};
