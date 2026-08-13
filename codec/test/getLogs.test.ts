import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

// One log from methods/eth_getLogs.md §1 (DAI Transfer).
const rawLog = () => ({
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x000000000000000000000000c2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8',
    '0x00000000000000000000000092f8a1b2c3d4e5f60718293a4b5c6d7e8f9026a7',
  ],
  data: '0x0000000000000000000000000000000000000000000000000f9c2a3b4c5d6e7f',
  blockNumber: '0x17ee6c0',
  blockHash: '0xa1b2c3d4e5f607182930415263748596a7b8c9d0e1f203142536475869708192',
  transactionHash: '0xd1f6e7a8b9c0d1e2f3041526374859607182939a4b5c6d7e8f0192a3b4c52790',
  transactionIndex: '0x14',
  logIndex: '0x234',
  removed: false,
});

// Expected T1, per methods/eth_getLogs.md §2. NOTE: block is 25093824
// (0x17ee6c0), correcting a typo in the spec doc which prints 25093728.
const compactLog = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0xc2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8',
    '0x92f8a1b2c3d4e5f60718293a4b5c6d7e8f9026a7',
  ],
  data: '0x0000000000000000000000000000000000000000000000000f9c2a3b4c5d6e7f',
  block: '25093824',
  block_hash: '0xa1b2c3d4e5f607182930415263748596a7b8c9d0e1f203142536475869708192',
  tx: '0xd1f6e7a8b9c0d1e2f3041526374859607182939a4b5c6d7e8f0192a3b4c52790',
  tx_index: '20',
  log_index: '564',
};

test('forward — per-log T1 keeps & renames position fields (spec §2)', () => {
  const out = forward('eth_getLogs', env([rawLog()])) as { result: unknown[] };
  assert.deepEqual(out.result[0], compactLog);
});

test('backward — reconstructs raw minus removed:false', () => {
  const compact = forward('eth_getLogs', env([rawLog()]));
  const restored = backward('eth_getLogs', compact) as { result: any[] };
  const expected = rawLog() as Record<string, any>;
  delete expected.removed;
  assert.deepEqual(restored.result[0], expected);
});

test('forward, `removed: true` is kept verbatim (eth_getLogs.md, unlike receipts)', () => {
  // The two documents differ on purpose: eth_getLogs.md drops `removed: false`
  // and keeps `removed: true` (a reorged-out log, rare on HTTP but spec-legal),
  // while the receipt document drops the field unconditionally.
  const log = rawLog() as Record<string, any>;
  log.removed = true;
  const out = forward('eth_getLogs', env([log])) as { result: any[] };
  assert.equal(out.result[0].removed, true);
});

test('empty result passes through verbatim', () => {
  assert.deepEqual(forward('eth_getLogs', env([])), env([]));
});

test('forward — collapses provider-decoded log, keeps position fields', () => {
  const log = rawLog() as Record<string, any>;
  log.event = 'Transfer';
  log.args = { from: '0xc2e9...', to: '0x92f8...', value: '1124671966097645359' };

  const out = forward('eth_getLogs', env([log])) as { result: any[] };
  assert.deepEqual(out.result[0], {
    contract: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    event: 'Transfer',
    args: { from: '0xc2e9...', to: '0x92f8...', value: '1124671966097645359' },
    block: '25093824',
    block_hash: '0xa1b2c3d4e5f607182930415263748596a7b8c9d0e1f203142536475869708192',
    tx: '0xd1f6e7a8b9c0d1e2f3041526374859607182939a4b5c6d7e8f0192a3b4c52790',
    tx_index: '20',
    log_index: '564',
  });
});
