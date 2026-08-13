import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { hexToDec } from '../src/rules/hex_to_dec.ts';

describe('hex_to_dec', () => {
  it('converts a small hex (block number) to a decimal string', () => {
    assert.equal(hexToDec('0x148a3f6'), '21537782');
  });

  it('converts gas-used to a decimal string', () => {
    assert.equal(hexToDec('0xa410'), '42000');
  });

  it('converts a wei-sized big hex to a decimal string (preserves precision)', () => {
    // 1.5 ETH = 1.5 * 10^18 wei = 1500000000000000000
    assert.equal(hexToDec('0x14d1120d7b160000'), '1500000000000000000');
  });

  it('emits a string for a safe-int value too: the type never depends on magnitude', () => {
    const small = hexToDec('0x1');
    const big = hexToDec('0xffffffffffffffffff');
    assert.equal(typeof small, 'string');
    assert.equal(typeof big, 'string');
    assert.equal(small, '1');
  });

  it('preserves a non-hex input unchanged', () => {
    assert.equal(hexToDec('not-hex'), 'not-hex');
  });

  it('returns input on malformed hex', () => {
    assert.equal(hexToDec('0xZZZ'), '0xZZZ');
  });

  it('returns zero as the string "0"', () => {
    assert.equal(hexToDec('0x0'), '0');
  });
});
