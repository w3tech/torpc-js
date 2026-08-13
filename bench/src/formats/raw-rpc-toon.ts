import { encode as toonEncode } from '@toon-format/toon';
import type { Format, Sample } from '../types/sample.ts';
import type { EncodedPayload } from '../types/index.ts';

/**
 * raw_rpc_toon — same JSON-RPC v2 envelope as raw_rpc, but serialized via TOON
 * instead of JSON. Isolates the pure serialisation delta on unstructured RPC replies.
 *
 * TOON is applied to the whole envelope (the simpler choice); a future variant
 * could apply TOON only to homogeneous arrays inside the envelope per spec §5.4.
 */
export const rawRpcToonFormat: Format = {
  name: 'raw_rpc_toon',
  encode(s: Sample): EncodedPayload {
    const envelope = {
      jsonrpc: '2.0',
      id: 1,
      result: s.result,
    };
    return {
      format: 'raw_rpc_toon',
      body: toonEncode(envelope),
      contentType: 'application/toon',
      raw: envelope,
    };
  },
};
