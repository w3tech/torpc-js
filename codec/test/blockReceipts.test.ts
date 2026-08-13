import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

// Each receipt is shape-identical to eth_getTransactionReceipt; one minimal receipt.
const rawReceipt = () => ({
  transactionHash: '0xaa',
  transactionIndex: '0x14',
  blockHash: '0xbb',
  blockNumber: '0x17ee5d9',
  from: '0x05ff6964d21e5dae3b1010d5ae0465b3c450f381',
  to: '0x2744dfd9898f0babbc570cc594bbbc84b487a22b',
  contractAddress: null,
  cumulativeGasUsed: '0x2ace4d',
  effectiveGasPrice: '0x8b485351',
  gasUsed: '0x135b3',
  type: '0x2',
  status: '0x1',
  logsBloom: '0x' + '0'.repeat(8),
  logs: [
    {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x0000000000000000000000002744dfd9898f0babbc570cc594bbbc84b487a22b',
      ],
      data: '0x06fc23ac00',
      blockNumber: '0x17ee5d9',
      transactionHash: '0xaa',
      logIndex: '0x4d',
      removed: false,
    },
  ],
});

test('forward — maps each receipt in the array (reuses receipt transform)', () => {
  const out = forward('eth_getBlockReceipts', env([rawReceipt()])) as { result: any[] };
  const r = out.result[0];
  assert.equal(r.tx, '0xaa');
  assert.equal(r.block, '25093593');
  assert.equal(r.gas_used, '79283');
  assert.equal(r.status, 'success');
  assert.equal('logsBloom' in r, false);
  assert.equal('cumulativeGasUsed' in r, false);
  assert.equal('type' in r, false);
  // log: EIP-55 address, stripped indexed topic, position fields dropped
  assert.equal(r.logs[0].address, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  assert.equal(r.logs[0].topics[1], '0x2744dfd9898f0babbc570cc594bbbc84b487a22b');
  assert.equal('blockNumber' in r.logs[0], false);
});

test('empty / null result pass through', () => {
  assert.deepEqual(forward('eth_getBlockReceipts', env([])), env([]));
  assert.deepEqual(forward('eth_getBlockReceipts', env(null)), env(null));
});

test('backward — re-pads topic & restores receipt-level numerics', () => {
  const compact = forward('eth_getBlockReceipts', env([rawReceipt()]));
  const restored = backward('eth_getBlockReceipts', compact) as { result: any[] };
  const r = restored.result[0];
  assert.equal(r.transactionHash, '0xaa');
  assert.equal(r.blockNumber, '0x17ee5d9');
  assert.equal(r.gasUsed, '0x135b3');
  assert.equal(r.status, '0x1');
  assert.equal(r.logs[0].topics[1], '0x0000000000000000000000002744dfd9898f0babbc570cc594bbbc84b487a22b');
});
