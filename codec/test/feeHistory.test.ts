import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

// Raw from methods/eth_feeHistory.md §1 (this doc's example values are correct).
const rawFee = () => ({
  oldestBlock: '0x180fc79',
  baseFeePerGas: ['0x724c4103', '0x78e3978d', '0x7a47805d', '0x875f1911', '0x880ef471'],
  gasUsedRatio: [0.7306662199192918, 0.546001558742848, 0.928271117493123, 0.5202979599356182],
  baseFeePerBlobGas: ['0x4ed2445', '0x527047a', '0x527047a', '0x56de794', '0x56de794'],
  blobGasUsedRatio: [0.5714285714285714, 0.0, 0.6666666666666666, 0.0],
  reward: [
    ['0xbebc200', '0x3c2d38a3', '0x621d21e0'],
    ['0x9f2b120', '0x448b9b80', '0x77359400'],
    ['0xa7d8c2', '0xdc88fb1', '0x5df55f27'],
    ['0xa852d20', '0x3b9aca00', '0x715bfc75'],
  ],
});

test('forward — renames + hex→dec on numeric arrays, floats verbatim (spec §2)', () => {
  const out = forward('eth_feeHistory', env(rawFee())) as { result: any };
  assert.equal(out.result.oldest_block, '25230457');
  assert.deepEqual(out.result.base_fee_per_gas, ['1917600003', '2028181389', '2051506269', '2271156497', '2282681457']);
  assert.deepEqual(out.result.base_fee_per_blob_gas, ['82650181', '86443130', '86443130', '91088788', '91088788']);
  assert.deepEqual(out.result.gas_used_ratio, rawFee().gasUsedRatio); // floats verbatim
  assert.deepEqual(out.result.reward[0], ['200000000', '1009596579', '1646076384']);
  // old keys gone
  assert.equal('oldestBlock' in out.result, false);
  assert.equal('baseFeePerGas' in out.result, false);
});

test('backward — exact round-trip (feeHistory is fully reversible, no drops)', () => {
  const compact = forward('eth_feeHistory', env(rawFee()));
  const restored = backward('eth_feeHistory', compact) as { result: unknown };
  assert.deepEqual(restored.result, rawFee());
});

test('pre-Cancun (no blob fields) — absent stays absent', () => {
  const pre = { oldestBlock: '0x10', baseFeePerGas: ['0x1', '0x2'], gasUsedRatio: [0.5] };
  const out = forward('eth_feeHistory', env(pre)) as { result: any };
  assert.equal('base_fee_per_blob_gas' in out.result, false);
  assert.equal(out.result.oldest_block, '16');
});
