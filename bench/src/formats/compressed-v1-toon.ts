import { encode as toonEncode } from '@toon-format/toon';
import type { Format, Sample } from '../types/sample.ts';
import type { EncodedPayload } from '../types/index.ts';
import { compressedV1Format } from './compressed-v1/index.ts';

/**
 * compressed_v1_toon — the same AEP envelope as compressed_v1, but serialized
 * via TOON instead of JSON. Lets the bench isolate:
 *   - format-design gain    : raw_rpc → compressed_v1   (envelope shape)
 *   - serialisation gain    : compressed_v1 → compressed_v1_toon   (encoding)
 *   - cumulative end-to-end : raw_rpc → compressed_v1_toon
 *
 * The underlying `raw` object is identical to compressed_v1's output, so the
 * scorer can pull canonical answers from either format interchangeably.
 */
export const compressedV1ToonFormat: Format = {
  name: 'compressed_v1_toon',
  encode(s: Sample): EncodedPayload {
    const inner = compressedV1Format.encode(s);
    return {
      format: 'compressed_v1_toon',
      body: toonEncode(inner.raw as object),
      contentType: 'application/vnd.ankr.compressed+toon;v=1',
      raw: inner.raw,
    };
  },
};
