import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });
const TX = '0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0';
const BH = '0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4';

// Raw tx from methods/eth_getTransactionByHash.md §1 (account-abstraction execute).
const rawTx = () => ({
  type: '0x2',
  chainId: '0x1',
  nonce: '0x108780',
  gas: '0x1db12',
  maxFeePerGas: '0x8dd57fc4',
  maxPriorityFeePerGas: '0x77359400',
  to: '0x2744dfd9898f0babbc570cc594bbbc84b487a22b',
  value: '0x0',
  accessList: [],
  input: '0xb61d27f6abcdef',
  r: '0x5861285dfe268bc03958a2bdc5bc00b153af4d1aafc125713a53310b9a449885',
  s: '0x211bf302e2e55352a9daa95f179fd4320ed28b5e6b01544a936a56701e526cb5',
  yParity: '0x1',
  v: '0x1',
  hash: TX,
  blockHash: BH,
  blockNumber: '0x17ee5d9',
  transactionIndex: '0x14',
  from: '0x05ff6964d21e5dae3b1010d5ae0465b3c450f381',
  gasPrice: '0x8b485351',
  blockTimestamp: '0x6a05ca1f',
});

test('forward — T1 tx mapping (corrected values vs spec §2)', () => {
  const out = forward('eth_getTransactionByHash', env(rawTx())) as { result: unknown };
  assert.deepEqual(out.result, {
    tx: TX,
    tx_index: '20',
    block: '25093593',
    block_hash: BH,
    from: '0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381',
    to: '0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b',
    nonce: '1083264',
    value: '0',
    gas_limit: '121618',
    gas_price: '2336772945',
    max_fee_per_gas: '2379579332',
    max_priority_fee_per_gas: '2000000000',
    input: '0xb61d27f6abcdef',
    block_timestamp: '1778764319',
  });
});

test('backward — reconstructs raw minus signature/envelope + empty access list', () => {
  const compact = forward('eth_getTransactionByHash', env(rawTx()));
  const restored = backward('eth_getTransactionByHash', compact) as { result: unknown };
  const expected = rawTx() as Record<string, any>;
  for (const k of ['chainId', 'type', 'v', 'r', 's', 'yParity', 'accessList']) delete expected[k];
  assert.deepEqual(restored.result, expected);
});

test('forward — collapses provider-decoded calldata (drops input, keeps function/args)', () => {
  const raw = rawTx() as Record<string, any>;
  raw.function = 'execute';
  raw.args = { to: '0xA0b8', value: '0', data: '0xa9059cbb', operation: '0' };
  const out = forward('eth_getTransactionByHash', env(raw)) as { result: any };
  assert.equal('input' in out.result, false);
  assert.equal(out.result.function, 'execute');
  assert.deepEqual(out.result.args, { to: '0xA0b8', value: '0', data: '0xa9059cbb', operation: '0' });
});

test('pure ETH transfer drops input ("0x"); contract creation keeps to:null', () => {
  const o1 = forward('eth_getTransactionByHash', env({ ...rawTx(), input: '0x' })) as { result: any };
  assert.equal('input' in o1.result, false);

  const o2 = forward('eth_getTransactionByHash', env({ ...rawTx(), to: null })) as { result: any };
  assert.equal(o2.result.to, null);
});

test('pending tx — null position fields renamed & preserved', () => {
  const pending = { ...rawTx(), blockHash: null, blockNumber: null, transactionIndex: null, blockTimestamp: null };
  const o = forward('eth_getTransactionByHash', env(pending)) as { result: any };
  assert.equal(o.result.block, null);
  assert.equal(o.result.block_hash, null);
  assert.equal(o.result.tx_index, null);
  assert.equal(o.result.block_timestamp, null);
});

test('access list — EIP-55 each entry address; dropped when empty', () => {
  const withAL = {
    ...rawTx(),
    accessList: [{ address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', storageKeys: ['0x00'] }],
  };
  const o = forward('eth_getTransactionByHash', env(withAL)) as { result: any };
  assert.deepEqual(o.result.access_list, [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', storageKeys: ['0x00'] },
  ]);
  assert.equal('accessList' in o.result, false);
});
