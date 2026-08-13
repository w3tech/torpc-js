import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { hexStrip } from '../src/rules/hex_strip.ts';

describe('hex_strip', () => {
  it('strips 12 leading zero bytes to a 20-byte value', () => {
    const padded = '0x0000000000000000000000008ba1f109551bd432803012645ac136ddd64dba72';
    const expected = '0x8ba1f109551bd432803012645ac136ddd64dba72';
    assert.equal(hexStrip(padded), expected);
  });

  it('strips 24 leading zero bytes to an 8-byte value', () => {
    // Regression: only the 12-zero-byte branch used to exist, so the spec's
    // exactly-24 case (specs/evm-v1.md §T1) was silently passed through.
    const padded = `0x${'0'.repeat(48)}1234567890abcdef`;
    assert.equal(hexStrip(padded), '0x1234567890abcdef');
  });

  it('counts zero bytes, not zero nibbles: a 49th zero nibble is still 24 zero bytes', () => {
    const padded = `0x${'0'.repeat(48)}0f42400000000000`;
    assert.equal(hexStrip(padded), '0x0f42400000000000');
  });

  it('keeps a 32-byte value with 29 leading zero bytes verbatim (a small uint256)', () => {
    // 0xf4240 padded to 32 bytes is neither the exactly-24 nor the exactly-12
    // case, so it passes through: the strip is shape-based, not value-based.
    const smallUint = `0x${'0'.repeat(59)}f4240`;
    assert.equal(hexStrip(smallUint), smallUint);
  });

  it('preserves a non-padded hex value unchanged', () => {
    const value = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    assert.equal(hexStrip(value), value);
  });

  it('preserves a keccak hash (32 bytes, no zero padding) unchanged', () => {
    const keccak = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    assert.equal(hexStrip(keccak), keccak);
  });

  it('preserves an all-zero 32-byte value unchanged', () => {
    // 32 leading zero bytes is neither the exactly-24 nor the exactly-12 case,
    // so the spec keeps the value verbatim. Stripping it would make the
    // transform irreversible for a bytes32 zero.
    const zeroPadded = `0x${'0'.repeat(64)}`;
    assert.equal(hexStrip(zeroPadded), zeroPadded);
  });

  it('lowercases the stripped payload and carries no EIP-55 claim', () => {
    const padded = '0x0000000000000000000000008BA1F109551BD432803012645AC136DDD64DBA72';
    assert.equal(hexStrip(padded), '0x8ba1f109551bd432803012645ac136ddd64dba72');
  });

  it('preserves original casing when it keeps a value verbatim', () => {
    const keccak = '0xDDF252AD1BE2C89B69C2B068FC378DAA952BA7F163C4A11628F55A4DF523B3EF';
    assert.equal(hexStrip(keccak), keccak);
  });

  it('returns a non-hex 32-byte-length string unchanged', () => {
    const notHex = `0x${'z'.repeat(64)}`;
    assert.equal(hexStrip(notHex), notHex);
  });

  it('does not mutate non-string inputs (defensive)', () => {
    // TypeScript prevents non-string at compile time, but runtime defensive
    const result = hexStrip(123 as unknown as string);
    assert.equal(result, 123);
  });
});
