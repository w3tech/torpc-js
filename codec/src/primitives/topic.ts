/**
 * Structural zero-block strip ⇄ pad primitive (torpc evm-v1 §T1).
 *
 * Shape-based and type-agnostic: a 32-byte hex value left-padded with
 * exactly 24 zero bytes collapses to its trailing 8 bytes; exactly 12 zero
 * bytes collapses to the trailing 20 bytes; anything else is left verbatim.
 * Output of a strip is lowercase and carries NO type claim (no EIP-55).
 * Fully reversible: pad re-expands any short 0x-hex value back to 32 bytes.
 *
 * Counts leading zero nibbles and divides by two for bytes, matching the
 * structural strip defined in the spec.
 */

const FULL_LEN = 2 + 64; // "0x" + 32 bytes

/** 32-byte 0x-hex → trailing 8 / 20 bytes when zero-padded, else unchanged. */
export function stripZeroBlock(value: string): string {
  if (value.length !== FULL_LEN || value[0] !== '0' || (value[1] !== 'x' && value[1] !== 'X')) {
    return value;
  }
  const body = value.slice(2).toLowerCase();

  let zeroNibbles = 0;
  for (const ch of body) {
    if (ch !== '0') break;
    zeroNibbles++;
  }
  const zeroBytes = Math.floor(zeroNibbles / 2);

  if (zeroBytes === 24) return '0x' + body.slice(48); // trailing 8 bytes
  if (zeroBytes === 12) return '0x' + body.slice(24); // trailing 20 bytes
  return value; // verbatim, original case preserved
}

/** Left-pad an 0x-hex value back to 32 bytes (inverse of stripZeroBlock). */
export function padZeroBlock(value: string): string {
  if (value.length < 2 || value[0] !== '0' || (value[1] !== 'x' && value[1] !== 'X')) {
    return value;
  }
  const body = value.slice(2);
  if (body.length >= 64 || !/^[0-9a-fA-F]*$/.test(body)) return value;
  return '0x' + body.padStart(64, '0');
}
