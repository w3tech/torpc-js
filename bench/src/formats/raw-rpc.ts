import type { Format, Sample } from '../types/sample.ts';
import type { EncodedPayload } from '../types/index.ts';

/**
 * Baseline format: wraps the captured result back into a standard JSON-RPC envelope
 * and pretty-prints it. This is exactly what a stock node/AAPI returns.
 */
export const rawRpcFormat: Format = {
  name: 'raw_rpc',
  encode(s: Sample): EncodedPayload {
    const envelope = {
      jsonrpc: '2.0',
      id: 1,
      result: s.result,
    };
    return {
      format: 'raw_rpc',
      body: JSON.stringify(envelope, null, 2),
      contentType: 'application/json',
      raw: envelope,
    };
  },
};
