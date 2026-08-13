import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });
const TX = '0x4d415bcf65c3ae5c21922db408a0c3c657897d04369cd35c9291181a09dccbc0';
const BH = '0x84d0b97ca6779f04f20164ceca89863c649ffafc475432b8cdfe3e70a70398b4';

// Raw block (full-tx mode) modeled on methods/eth_getBlockByHash.md §1.
const rawBlock = () => ({
  hash: BH,
  parentHash: '0xc0d2b8e9',
  sha3Uncles: '0x1dcc4de8',
  miner: '0x1f9090aae28b8a3dceadf281b0f12828e676c326',
  stateRoot: '0xs',
  transactionsRoot: '0xt',
  receiptsRoot: '0xr',
  logsBloom: '0x' + '0'.repeat(8),
  difficulty: '0x0',
  number: '0x17ee5d9',
  gasLimit: '0x223995a',
  gasUsed: '0x23089ed',
  timestamp: '0x6a05ca1f',
  extraData: '0xd883',
  mixHash: '0xm',
  nonce: '0x0000000000000000',
  baseFeePerGas: '0x4f81e30',
  withdrawalsRoot: '0xw',
  blobGasUsed: '0x40000',
  excessBlobGas: '0x6c80000',
  parentBeaconBlockRoot: '0xp',
  requestsHash: '0xe3b0c44',
  size: '0x26f71',
  uncles: [],
  transactions: [
    {
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
      r: '0x58',
      s: '0x21',
      yParity: '0x1',
      v: '0x1',
      hash: TX,
      blockHash: BH,
      blockNumber: '0x17ee5d9',
      transactionIndex: '0x14',
      from: '0x05ff6964d21e5dae3b1010d5ae0465b3c450f381',
      gasPrice: '0x8b485351',
      blockTimestamp: '0x6a05ca1f',
    },
  ],
  withdrawals: [
    { index: '0x4f0b6c1', validatorIndex: '0x123abc', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', amount: '0x3f4a7c2' },
  ],
});

test('forward — full-tx block (corrected values vs spec §2)', () => {
  const out = forward('eth_getBlockByNumber', env(rawBlock())) as { result: unknown };
  assert.deepEqual(out.result, {
    block: '25093593',
    block_hash: BH,
    parent_hash: '0xc0d2b8e9',
    miner: '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
    timestamp: '1778764319',
    gas_used: '36735469',
    gas_limit: '35887450',
    size: '159601',
    base_fee_per_gas: '83369520',
    blob_gas_used: '262144',
    excess_blob_gas: '113770496',
    uncles: [],
    transactions: [
      {
        tx: TX,
        tx_index: '20',
        from: '0x05ff6964D21e5dAE3b1010D5AE0465b3c450F381',
        to: '0x2744dfD9898f0bAbbC570cC594Bbbc84b487a22b',
        nonce: '1083264',
        value: '0',
        gas_limit: '121618',
        gas_price: '2336772945',
        max_fee_per_gas: '2379579332',
        max_priority_fee_per_gas: '2000000000',
        input: '0xb61d27f6abcdef',
      },
    ],
    withdrawals: [
      { index: '82884289', validator_index: '1194684', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', amount: '66365378' },
    ],
  });
});

test('hashes-only mode — transactions kept verbatim', () => {
  const raw = { ...rawBlock(), transactions: [TX, '0xabc'] };
  const out = forward('eth_getBlockByHash', env(raw)) as { result: any };
  assert.deepEqual(out.result.transactions, [TX, '0xabc']);
});

test('backward — header numerics restored (per-tx block context not redistributed)', () => {
  const compact = forward('eth_getBlockByNumber', env(rawBlock()));
  const restored = backward('eth_getBlockByNumber', compact) as { result: any };
  assert.equal(restored.result.number, '0x17ee5d9');
  assert.equal(restored.result.hash, BH);
  assert.equal(restored.result.gasUsed, '0x23089ed');
  assert.equal(restored.result.baseFeePerGas, '0x4f81e30');
  // per-tx: tx renamed back, block context stays absent (flat inverse, §6)
  assert.equal(restored.result.transactions[0].hash, TX);
  assert.equal('blockNumber' in restored.result.transactions[0], false);
  assert.equal(restored.result.withdrawals[0].validatorIndex, '0x123abc');
});
