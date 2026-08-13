/**
 * Double-application regressions.
 *
 * A proxy chain can hand the same response to the codec twice (a sidecar in
 * front of a transforming upstream, a retry through two hops, a test harness
 * that reuses its own output). The audit found that this silently corrupted
 * values: hexToDec accepted unprefixed hex, so "0x10" became "16" and a second
 * pass read "16" as hex and emitted "22".
 *
 * The exposed fields are the ones a rename does not hide from the second pass,
 * meaning every field whose compact key equals its standard key, plus the
 * scalar hex-integer methods where the whole result is the numeric. Those are
 * the cases pinned here. The fix is in the primitive, not per field: hexToDec
 * requires the 0x prefix and decToHex refuses it, so the second pass falls
 * through to the spec's verbatim passthrough.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

test('scalar hex-integer method: forward twice is forward once', () => {
  const once = forward('eth_blockNumber', env('0x10')) as { result: unknown };
  assert.equal(once.result, '16');
  assert.deepEqual(forward('eth_blockNumber', once), once); // used to be "22"

  const big = forward('eth_getBalance', env('0x1f5d275aa12bbfc77fbf4')) as { result: unknown };
  assert.equal(big.result, '2369787902783018340187124');
  assert.deepEqual(forward('eth_getBalance', big), big);
});

test('scalar hex-integer method: backward twice is backward once', () => {
  const once = backward('eth_blockNumber', env('16')) as { result: unknown };
  assert.equal(once.result, '0x10');
  assert.deepEqual(backward('eth_blockNumber', once), once);
});

test('same-key numerics (timestamp, size, nonce, value): forward twice is forward once', () => {
  const raw = env({
    number: '0x17ee5d9',
    timestamp: '0x6a05ca1f',
    size: '0x26f71',
    transactions: [{ hash: '0xabc', nonce: '0x108780', value: '0x2540be400' }],
    withdrawals: [{ index: '0x4f0b6c1', validatorIndex: '0x123abc', amount: '0x3f4a7c2' }],
  });
  const once = forward('eth_getBlockByNumber', raw) as { result: any };
  assert.equal(once.result.timestamp, '1778764319');
  assert.equal(once.result.size, '159601');
  assert.equal(once.result.transactions[0].nonce, '1083264');
  assert.equal(once.result.transactions[0].value, '10000000000');
  assert.equal(once.result.withdrawals[0].index, '82884289');
  assert.equal(once.result.withdrawals[0].amount, '66365378');

  const twice = forward('eth_getBlockByNumber', once) as { result: any };
  assert.deepEqual(twice.result, once.result);
});

test('feeHistory reward: the 2D array keeps its key, so it must survive a second pass', () => {
  const once = forward('eth_feeHistory', env({
    oldestBlock: '0x180fc79',
    reward: [['0xbebc200', '0x3c2d38a3'], ['0x9f2b120', '0x448b9b80']],
  })) as { result: any };
  assert.deepEqual(once.result.reward, [['200000000', '1009596579'], ['166900000', '1150000000']]);

  const twice = forward('eth_feeHistory', once) as { result: any };
  assert.deepEqual(twice.result, once.result);
});

test('over-width numeric passes through verbatim, rest of the response still transforms', () => {
  const wide = '0x' + 'f'.repeat(65); // wider than a 256-bit word
  const out = forward('eth_getBlockByNumber', env({ number: wide, timestamp: '0x6a05ca1f' })) as { result: any };
  // Behavior rule 2: original key, original value, and no downgrade of the rest.
  assert.equal(out.result.number, wide);
  assert.equal('block' in out.result, false);
  assert.equal(out.result.timestamp, '1778764319');
  // and the same for a scalar method, where the whole result is the numeric
  assert.deepEqual(forward('eth_getBalance', env(wide)), env(wide));
});
