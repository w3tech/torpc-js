import type { Format, Sample } from '../../types/sample.ts';
import type { EncodedPayload } from '../../types/index.ts';
import {
  compressAccountBalance,
  compressBalance,
  compressBlock,
  compressLogs,
  compressNFTs,
  compressReceipt,
  compressTokenTransfers,
  compressTransaction,
  compressTransactionCount,
} from './methods.ts';

type Compressor = (raw: unknown) => unknown;

const COMPRESSORS: Record<string, Compressor> = {
  eth_getTransactionReceipt: compressReceipt,
  eth_getTransactionByHash: compressTransaction,
  eth_getBlockByNumber: compressBlock,
  eth_getLogs: compressLogs,
  eth_getBalance: compressBalance,
  eth_getTransactionCount: compressTransactionCount,
  ankr_getAccountBalance: compressAccountBalance,
  ankr_getTokenTransfers: compressTokenTransfers,
  ankr_getNFTsByOwner: compressNFTs,
};

export const compressedV1Format: Format = {
  name: 'compressed_v1',
  encode(s: Sample): EncodedPayload {
    const compressor = COMPRESSORS[s.method];
    if (!compressor) {
      // No compressor → pass through (so we get fair raw_rpc-equivalent measurement)
      const envelope = { jsonrpc: '2.0', id: 1, result: s.result };
      return {
        format: 'compressed_v1',
        body: JSON.stringify(envelope, null, 2),
        contentType: 'application/json',
        raw: envelope,
      };
    }
    const compressed = compressor(s.result);
    return {
      format: 'compressed_v1',
      body: JSON.stringify(compressed, null, 2),
      contentType: 'application/vnd.ankr.compressed+json;v=1',
      raw: compressed,
    };
  },
};
