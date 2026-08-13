import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forward, backward } from '../src/index.ts';

const env = (result: unknown) => ({ jsonrpc: '2.0', id: 1, result });

// Raw uncle header from methods/eth_getUncleByBlockHashAndIndex.md §1.
const rawUncle = () => ({
  hash: '0xd13e27ec74fef9dd42742daecda760def1a9bb836f4342230fef4195c187fdfd',
  parentHash: '0x63a9c78cb84cc8ff33371c31a1c8efb24c044694a20bfb920f96c58cab512cd9',
  sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
  miner: '0x6a86bbe22d73cbf0df82ef96d78d99ce585e690c',
  stateRoot: '0x91aec9a9dbbb60ce9302601f8e44075f17ac2f6b8ad3aba0b920b9587032c3a2',
  transactionsRoot: '0xc59b5ce80c7e1857963794c3a87f11e0674f54b014b0c40ec93dd00e5b45ceb4',
  receiptsRoot: '0xb8c01c51e89e42f595c11db95cd18a856ce031968fe27797415ac8b5a68f80db',
  logsBloom: '0x' + '7'.repeat(512),
  difficulty: '0x1a4d099aca7ec9',
  number: '0xc59f72',
  gasLimit: '0xe4a889',
  gasUsed: '0xe47488',
  timestamp: '0x610907a4',
  extraData: '0x',
  mixHash: '0xcb95fd7f358e5118d95f98265f049e9955cc068bb6ccbcd90084948b633f342a',
  nonce: '0xcf830b788056f55b',
  size: '0x209',
  uncles: [],
});

const DROPPED = ['sha3Uncles', 'stateRoot', 'transactionsRoot', 'receiptsRoot', 'logsBloom', 'difficulty', 'extraData', 'mixHash', 'nonce'];

test('forward — header subset (corrected miner checksum vs spec §2)', () => {
  const out = forward('eth_getUncleByBlockNumberAndIndex', env(rawUncle())) as { result: unknown };
  assert.deepEqual(out.result, {
    block: '12951410',
    block_hash: '0xd13e27ec74fef9dd42742daecda760def1a9bb836f4342230fef4195c187fdfd',
    parent_hash: '0x63a9c78cb84cc8ff33371c31a1c8efb24c044694a20bfb920f96c58cab512cd9',
    miner: '0x6A86BBe22d73CBf0dF82eF96d78d99cE585E690C',
    timestamp: '1627981732',
    gas_used: '14972040',
    gas_limit: '14985353',
    size: '521',
    uncles: [],
  });
});

test('backward — reconstructs raw minus dropped header service fields', () => {
  const compact = forward('eth_getUncleByBlockHashAndIndex', env(rawUncle()));
  const restored = backward('eth_getUncleByBlockHashAndIndex', compact) as { result: unknown };
  const expected = rawUncle() as Record<string, any>;
  for (const k of DROPPED) delete expected[k];
  assert.deepEqual(restored.result, expected);
});

test('null result passes through', () => {
  assert.deepEqual(forward('eth_getUncleByBlockHashAndIndex', env(null)), env(null));
});
