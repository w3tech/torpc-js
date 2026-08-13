/**
 * Hex-integer ⇄ decimal-string primitive (torpc evm-v1 §T1 "hex-to-decimal").
 *
 * Forward emits a decimal string at full precision (values routinely exceed
 * 2^53, e.g. wei balances) via BigInt. Backward reproduces lowercase 0x-hex.
 * Both return `null` on malformed input so callers can pass the field
 * through verbatim (spec §Behavior "transformation-failure passthrough").
 *
 * Two guards keep the pair safe on already-transformed and on hostile input.
 *
 * 1. Prefix. `hexToDec` requires the `0x` prefix and `decToHex` refuses it. A
 *    JSON-RPC quantity always carries the prefix and a decimal string never
 *    does, so applying either direction twice is a passthrough rather than a
 *    silent re-read: without this, a second forward pass read the decimal
 *    `"16"` back as hex and emitted `"22"`.
 * 2. Width. The widest numeric the EVM produces is a 256-bit word: 64 hex
 *    digits, 78 decimal digits. BigInt parsing and base-10 formatting are
 *    superlinear in digit count, so an unbounded numeric field is a cheap way
 *    to burn CPU on a response we did not author. Wider than a word is not an
 *    EVM numeric, and verbatim passthrough is what the spec already
 *    prescribes for a value that is not in the expected format.
 *
 * The two caps are consistent in the round trip: the widest value `hexToDec`
 * accepts is 2^256-1, whose decimal form is exactly 78 digits, which is the
 * widest `decToHex` accepts.
 */

/** 2^256-1 is 64 hex digits wide. */
const MAX_HEX_DIGITS = 64;
/** 2^256-1 is 78 decimal digits wide. */
const MAX_DEC_DIGITS = 78;

const HEX_INT = /^0[xX][0-9a-fA-F]*$/;
const DEC_INT = /^\d+$/;

/** 0x-prefixed hex integer → decimal string. `"0x"` → `"0"`. Anything else → `null`. */
export function hexToDec(hex: string): string | null {
  if (hex.length > 2 + MAX_HEX_DIGITS) return null; // width first, so a hostile field is never scanned
  if (!HEX_INT.test(hex)) return null;
  const body = hex.slice(2);
  if (body === '') return '0';
  return BigInt('0x' + body).toString(10);
}

/** Non-negative decimal string → lowercase 0x-hex. `"0"` → `"0x0"`. Anything else → `null`. */
export function decToHex(dec: string): string | null {
  if (dec.length > MAX_DEC_DIGITS) return null;
  if (!DEC_INT.test(dec)) return null;
  return '0x' + BigInt(dec).toString(16);
}
