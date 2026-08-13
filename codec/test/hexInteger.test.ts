import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward, forwardBatch, backwardBatch } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

test('eth_blockNumber — forward decodes, backward re-encodes', () => {
  assert.deepEqual(forward('eth_blockNumber', env('0x180fcbd')), env('25230525'));
  assert.deepEqual(backward('eth_blockNumber', env('25230525')), env('0x180fcbd'));
});

test('eth_getBalance — full precision round-trip', () => {
  const raw = env('0x1f5d275aa12bbfc77fbf4');
  const compact = forward('eth_getBalance', raw);
  assert.deepEqual(compact, env('2369787902783018340187124'));
  assert.deepEqual(backward('eth_getBalance', compact), raw);
});

test('null result passes through verbatim', () => {
  assert.deepEqual(forward('eth_getBlockTransactionCountByHash', env(null)), env(null));
});

test('error responses pass through verbatim', () => {
  const errResp = { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'boom' } };
  assert.deepEqual(forward('eth_blockNumber', errResp), errResp);
});

test('unsupported method passes through verbatim', () => {
  assert.deepEqual(forward('eth_unknownMethod', env('0xabc')), env('0xabc'));
});

test('does not mutate the input response', () => {
  const raw = env('0x180fcbd');
  forward('eth_blockNumber', raw);
  assert.equal(raw.result, '0x180fcbd');
});

test('batch routes each element by its own method', () => {
  const items = [
    { method: 'eth_blockNumber', response: env('0x10') },
    { method: 'eth_chainId', response: env('0x1') },
  ];
  assert.deepEqual(forwardBatch(items), [env('16'), env('1')]);
  assert.deepEqual(
    backwardBatch([
      { method: 'eth_blockNumber', response: env('16') },
      { method: 'eth_chainId', response: env('1') },
    ]),
    [env('0x10'), env('0x1')],
  );
});
