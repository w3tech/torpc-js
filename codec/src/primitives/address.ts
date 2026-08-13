/**
 * Address casing primitive (torpc evm-v1 §T1 EIP-55).
 *
 * Forward applies EIP-55 mixed-case checksum to dedicated 20-byte address
 * fields; backward lowercases (the standard form most nodes emit). Non-address
 * inputs pass through unchanged — we never corrupt a value we don't recognise.
 *
 * keccak256 is the only crypto dependency in this package, used here alone.
 */

import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Apply EIP-55 checksum casing. Non-address strings returned unchanged. */
export function eip55(addr: string): string {
  if (!ADDRESS.test(addr)) return addr;
  const lower = addr.slice(2).toLowerCase();
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)));
  let out = '0x';
  for (let i = 0; i < 40; i++) {
    const c = lower[i]!;
    out += c >= 'a' && c <= 'f' && parseInt(hash[i]!, 16) >= 8 ? c.toUpperCase() : c;
  }
  return out;
}

/** Lowercase a 20-byte address. Non-address strings returned unchanged. */
export function lower(addr: string): string {
  return ADDRESS.test(addr) ? addr.toLowerCase() : addr;
}
