import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToDec,
  decToHex,
  stripZeroBlock,
  padZeroBlock,
  eip55,
  lower,
} from '../src/primitives/index.ts';

test('hexToDec / decToHex — scalar examples (methods/eth_hexInteger.md)', () => {
  assert.equal(hexToDec('0x180fcbd'), '25230525');
  assert.equal(decToHex('25230525'), '0x180fcbd');
  assert.equal(hexToDec('0x'), '0'); // degenerate empty
  assert.equal(decToHex('0'), '0x0');
});

test('hexToDec — full precision beyond 2^53 (wei balances)', () => {
  const hex = '0x1f5d275aa12bbfc77fbf4';
  assert.equal(hexToDec(hex), '2369787902783018340187124');
  assert.equal(decToHex('2369787902783018340187124'), hex); // round-trips
});

test('hexToDec / decToHex — malformed → null (passthrough signal)', () => {
  assert.equal(hexToDec('not-hex'), null);
  assert.equal(decToHex('0xabc'), null);
  assert.equal(decToHex('-1'), null);
});

test('hexToDec requires the 0x prefix, so a second pass cannot re-read the output', () => {
  // Regression: unprefixed hex used to be accepted, so applying forward twice
  // read the decimal "16" back as hex and emitted "22".
  assert.equal(hexToDec('16'), null);
  assert.equal(hexToDec('10'), null);
  assert.equal(hexToDec('25230525'), null);
  assert.equal(hexToDec('deadbeef'), null);
  assert.equal(hexToDec('0X10'), '16'); // uppercase prefix still accepted
  // decToHex is the mirror image (it refuses the prefix) and stays the inverse
  assert.equal(decToHex(hexToDec('0x10') as string), '0x10');
  assert.equal(decToHex('0x10'), null);
});

test('hexToDec / decToHex capped at one 256-bit word, wider input passes through', () => {
  const word = 'f'.repeat(64);
  const max = (2n ** 256n - 1n).toString(10);
  assert.equal(max.length, 78); // the widest decimal hexToDec can emit
  assert.equal(hexToDec('0x' + word), max);
  assert.equal(decToHex(max), '0x' + word); // so the round trip is not clipped by the decimal cap
  assert.equal(hexToDec('0x' + 'f'.repeat(65)), null); // one digit past a word: not an EVM numeric
  assert.equal(decToHex('1' + '0'.repeat(78)), null); // 79 decimal digits
});

test('hexToDec refuses a megabyte-wide numeric fast, without converting it', () => {
  const hostile = '0x' + 'f'.repeat(4_000_000);
  const started = process.hrtime.bigint();
  assert.equal(hexToDec(hostile), null);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  // Before the width cap this took about 1500 ms: BigInt parsing and base-10
  // formatting are both superlinear in digit count.
  assert.ok(ms < 500, `width cap should short-circuit, took ${ms.toFixed(1)} ms`);
});

test('stripZeroBlock — 12 zero bytes → trailing 20 (methods/eth_getLogs.md)', () => {
  const padded = '0x000000000000000000000000c2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8';
  assert.equal(stripZeroBlock(padded), '0xc2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8');
  assert.equal(padZeroBlock('0xc2e9eb3d2f1a3b4c5d6e7f8091a2b3c4d5e625f8'), padded);
});

test('stripZeroBlock — 24 zero bytes → trailing 8', () => {
  const padded = '0x000000000000000000000000000000000000000000000000deadbeefdeadbeef';
  assert.equal(stripZeroBlock(padded), '0xdeadbeefdeadbeef');
  assert.equal(padZeroBlock('0xdeadbeefdeadbeef'), padded);
});

test('stripZeroBlock — topic0 (no leading zeros) left verbatim', () => {
  const topic0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  assert.equal(stripZeroBlock(topic0), topic0);
  assert.equal(padZeroBlock(topic0), topic0); // already 32 bytes
});

test('eip55 — canonical checksum vectors', () => {
  assert.equal(
    eip55('0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'),
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  );
  assert.equal(
    eip55('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  );
  // USDC, from methods/eth_getTransactionByHash.md §3
  assert.equal(
    eip55('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  );
  assert.equal(lower('0xA0b86991c6218b36c1D19D4a2e9Eb0cE3606eB48'), '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
});

test('eip55 / lower — non-address strings pass through', () => {
  assert.equal(eip55('0x1234'), '0x1234');
  assert.equal(lower('hello'), 'hello');
});
