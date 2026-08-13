/**
 * Rule `hex_to_dec`: convert a hex quantity to its decimal representation.
 *
 * Normative spec: `specs/evm-v1.md` §T1 ("Hex-to-decimal numeric encoding").
 *
 * Behavior:
 * - A `0x`-prefixed hex quantity is converted to its decimal representation and
 *   returned as a **string, always, regardless of magnitude**. v1 deliberately
 *   does not switch type by magnitude: a number for small values and a string
 *   for large ones makes the same field change type between two elements of one
 *   response (a small `value` in one log, a wei-sized one in the next), which is
 *   painful for every statically typed consumer.
 * - Non-hex input is returned unchanged. This rule does not classify field
 *   types; callers filter to the hex fields their method ruleset names.
 * - Malformed hex is returned unchanged (`specs/evm-v1.md` §Behavior, rule 2,
 *   transformation-failure passthrough).
 */

export function hexToDec(value: string): string {
  if (typeof value !== 'string' || !value.startsWith('0x')) {
    return value as never;
  }

  try {
    return BigInt(value).toString(10);
  } catch {
    // Malformed hex, return unchanged.
    return value;
  }
}
