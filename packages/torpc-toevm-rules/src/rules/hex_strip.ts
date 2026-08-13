/**
 * Rule `hex_strip`: the structural zero-block strip on 32-byte hex values.
 *
 * Normative spec: `specs/evm-v1.md` §T1 ("Structural zero-block strip on
 * 32-byte hex values").
 *
 * Input: a `0x`-prefixed 32-byte hex value (typically `topics[1..N]` of a log
 * entry). Count the leading zero bytes:
 * - exactly 24 leading zero bytes, emit the trailing 8 bytes (`0x` + 16 hex
 *   chars);
 * - exactly 12 leading zero bytes, emit the trailing 20 bytes (`0x` + 40 hex
 *   chars);
 * - anything else, including an all-zero value (32 leading zero bytes), is kept
 *   verbatim with its original casing.
 *
 * The strip is shape-based and type-agnostic: it makes no claim that the value
 * is an address, a uint or a bytes32. Output is therefore lowercase, and EIP-55
 * casing MUST NOT be applied to it by any later step. The transform is fully
 * reversible: left-pad the result back to 32 bytes with zero bytes.
 */

const FULL_LEN = 2 + 64; // "0x" + 32 bytes

export function hexStrip(value: string): string {
  if (typeof value !== 'string') return value;
  if (value.length !== FULL_LEN) return value;
  if (value[0] !== '0' || (value[1] !== 'x' && value[1] !== 'X')) return value;

  const body = value.slice(2);
  if (!/^[0-9a-fA-F]{64}$/.test(body)) return value;

  const lower = body.toLowerCase();

  let zeroNibbles = 0;
  for (const ch of lower) {
    if (ch !== '0') break;
    zeroNibbles++;
  }
  const zeroBytes = Math.floor(zeroNibbles / 2);

  if (zeroBytes === 24) return `0x${lower.slice(48)}`; // trailing 8 bytes
  if (zeroBytes === 12) return `0x${lower.slice(24)}`; // trailing 20 bytes
  return value; // verbatim, original casing preserved
}
