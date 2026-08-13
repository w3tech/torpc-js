import type { CapturedResponse, EncodedPayload, FixtureKind } from './index.ts';

/**
 * A "sample" is one captured response from one RPC call.
 * It is the atomic unit that format adapters encode and tokenizers measure.
 */
export interface Sample {
  fixtureId: string;
  fixtureKind: FixtureKind;
  method: string;
  result: unknown;
  source: 'eth_jsonrpc' | 'ankr_aapi';
}

export function captureToSample(c: CapturedResponse, fixtureKind: FixtureKind): Sample {
  return {
    fixtureId: c.fixtureId,
    fixtureKind,
    method: c.method,
    result: c.result,
    source: c.source,
  };
}

/**
 * A format adapter takes a Sample and produces an EncodedPayload (string body + raw object).
 */
export interface Format {
  name: string;
  encode(sample: Sample): EncodedPayload;
}
