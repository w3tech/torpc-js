import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const TX = '0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0';
const BLOCK_HASH = '0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4';
const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

// Raw response from methods/eth_getTransactionReceipt.md §1 (USDC transfer).
const rawReceipt = () => ({
  blockHash: BLOCK_HASH,
  blockNumber: '0x17ee5d9',
  contractAddress: null,
  cumulativeGasUsed: '0x2ace4d',
  effectiveGasPrice: '0x8b485351',
  from: '0x05ff6964d21e5dae3b1010d5ae0465b3c450f381',
  gasUsed: '0x135b3',
  logs: [
    {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x0000000000000000000000002744dfd9898f0babbc570cc594bbbc84b487a22b',
        '0x000000000000000000000000fa21f001ef54ac2510d72e854a492b8731c3e7fa',
      ],
      data: '0x00000000000000000000000000000000000000000000000000000006fc23ac00',
      blockNumber: '0x17ee5d9',
      transactionHash: TX,
      transactionIndex: '0x14',
      blockHash: BLOCK_HASH,
      blockTimestamp: '0x6a05ca1f',
      logIndex: '0x4d',
      removed: false,
    },
  ],
  logsBloom: '0x' + '0'.repeat(512),
  status: '0x1',
  to: '0x2744dfd9898f0babbc570cc594bbbc84b487a22b',
  transactionHash: TX,
  transactionIndex: '0x14',
  type: '0x2',
});

// Expected T1 compact (undecoded), per methods/eth_getTransactionReceipt.md §2.
const compactT1 = {
  tx: TX,
  tx_index: '20',
  block: '25093593',
  block_hash: BLOCK_HASH,
  from: '0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381',
  to: '0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b',
  status: 'success',
  gas_used: '79283',
  gas_price: '2336772945',
  logs: [
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        '0x2744dfd9898f0babbc570cc594bbbc84b487a22b',
        '0xfa21f001ef54ac2510d72e854a492b8731c3e7fa',
      ],
      data: '0x00000000000000000000000000000000000000000000000000000006fc23ac00',
    },
  ],
};

test('forward — T1 mechanical mapping matches spec §2', () => {
  const out = forward('eth_getTransactionReceipt', env(rawReceipt())) as { result: unknown };
  assert.deepEqual(out.result, compactT1);
});

test('backward — reconstructs raw minus documented lossy fields', () => {
  const compact = forward('eth_getTransactionReceipt', env(rawReceipt()));
  const restored = backward('eth_getTransactionReceipt', compact) as { result: unknown };

  // expected = raw with the lossy fields removed (design spec §7)
  const expected = rawReceipt() as Record<string, any>;
  delete expected.cumulativeGasUsed;
  delete expected.type;
  delete expected.logsBloom;
  delete expected.contractAddress; // was null → dropped, unrecoverable
  for (const log of expected.logs) {
    delete log.blockNumber;
    delete log.transactionHash;
    delete log.blockHash;
    delete log.transactionIndex;
    delete log.blockTimestamp;
    delete log.logIndex;
    delete log.removed;
  }
  assert.deepEqual(restored.result, expected);
});

test('forward, per-log `removed` is dropped even when true (receipt per-log table)', () => {
  // methods/eth_getTransactionReceipt.md lists `removed` as an unconditional
  // drop: a receipt is only returned for a mined transaction. eth_getLogs is
  // the method that keeps `removed: true`, and it has its own test for that.
  const raw = rawReceipt() as Record<string, any>;
  raw.logs[0].removed = true;
  const out = forward('eth_getTransactionReceipt', env(raw)) as { result: any };
  assert.equal('removed' in out.result.logs[0], false);
});

test('forward — collapses a provider-decoded log (spec §3 T2 shape)', () => {
  const raw = rawReceipt() as Record<string, any>;
  raw.logs[0].event = 'Transfer';
  raw.logs[0].args = {
    from: '0x2744dFD9898f0BABbc570CC594bBBC84b487a22B',
    to: '0xfa21F001Ef54Ac2510d72E854a492b8731c3E7fa',
    value: '30000000000',
  };

  const out = forward('eth_getTransactionReceipt', env(raw)) as { result: any };
  assert.deepEqual(out.result.logs[0], {
    contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    event: 'Transfer',
    args: {
      from: '0x2744dFD9898f0BABbc570CC594bBBC84b487a22B',
      to: '0xfa21F001Ef54Ac2510d72E854a492b8731c3E7fa',
      value: '30000000000',
    },
  });
});

test('backward — a collapsed log loses raw topics/data (lossy by design)', () => {
  const collapsed = env({
    tx: TX,
    block: '25093593',
    logs: [
      {
        contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        event: 'Transfer',
        args: { from: '0xfoo', to: '0xbar', value: '30000000000' },
      },
    ],
  });
  const restored = backward('eth_getTransactionReceipt', collapsed) as { result: any };
  // contract→address renamed + lowercased; event/args untouched; no topics/data
  assert.deepEqual(restored.result.logs[0], {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    event: 'Transfer',
    args: { from: '0xfoo', to: '0xbar', value: '30000000000' },
  });
});
