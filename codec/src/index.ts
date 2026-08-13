/**
 * @torpc/codec — reference bidirectional mapper between standard EVM JSON-RPC
 * responses and the TORPC compact form. Structural only: no ABI resolution,
 * no decoding of raw calldata/logs, no re-encoding. See the design spec and
 * torpc/specs/evm-v1.md.
 */

export { forward, backward, forwardBatch, backwardBatch } from './dispatch.ts';
export type { BatchItem, JsonRpcResponse } from './dispatch.ts';

export { registry } from './methods/index.ts';
export type { MethodMapper } from './methods/registry.ts';

export * as primitives from './primitives/index.ts';
