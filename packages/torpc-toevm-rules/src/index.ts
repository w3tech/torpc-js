/**
 * @torpc/toevm-rules, public entry point.
 *
 * Normative semantics live in the spec repository: `specs/evm-v1.md` for the
 * tier mechanism and the T1 / T2 primitives, `specs/methods/` for the
 * per-method field mappings.
 *
 * This package is a partial reference of the T1 primitives, not a complete
 * implementation of the spec. See README.md for what it does and does not do.
 */

export type {
  RuleId,
  Rule,
  RuleContext,
  RawReceipt,
  RawLog,
  CompressedReceipt,
  CompressedLog,
  CompressedLogT1,
  CompressedLogT2,
  CompressedLogUnknown,
} from './types.ts';

export { hexStrip } from './rules/hex_strip.ts';
export { hexToDec } from './rules/hex_to_dec.ts';
export { dropServiceFields } from './rules/drop_service_fields.ts';

/**
 * The specification revision this package targets: EVM RPC Compression v1,
 * `specs/evm-v1.md` plus `specs/methods/`. This is the spec's own revision
 * label, not a package version; the package version lives in package.json.
 */
export const TARGET_SPEC = 'evm-v1' as const;
