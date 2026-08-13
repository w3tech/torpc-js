/**
 * Type-aware deterministic scorer. No LLM judge.
 *
 * Each question declares an AnswerType. The scorer normalizes both the LLM
 * answer and every entry in `expected[]` according to that type, then accepts
 * iff at least one expected entry matches the LLM answer after normalization.
 */

export type AnswerType =
  | 'number'
  | 'number_signed'
  | 'integer'
  | 'bigint'
  | 'hex'
  | 'address'
  | 'boolean'
  | 'boolean_enum'
  | 'enum'
  | 'token_set'
  | 'freeform';

export interface ScoreInput {
  llmAnswer: string;
  expected: string[];
  type: AnswerType;
}

export interface ScoreResult {
  correct: boolean;
  normalisedLlm: string;
  matchedExpected?: string;
}

// ---------- normalisers ----------

/**
 * Trim a run of one character from both ends. A `/^\.+|\.+$/` regex is super-linear on
 * adversarial input (a long run of dots); two scans are linear and do the same job.
 */
function trimChar(s: string, ch: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === ch) start++;
  while (end > start && s[end - 1] === ch) end--;
  return s.slice(start, end);
}

function stripJunk(s: string): string {
  const unquoted = s
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/^`|`$/g, '');
  return trimChar(unquoted, '.').trim();
}

function toCanonicalNumber(s: string): number | null {
  // Strip common currency / unit decorations.
  const cleaned = stripJunk(s)
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\bUSD\b/gi, '')
    .replace(/\bETH\b/gi, '')
    .replace(/\bUSDC\b/gi, '')
    .replace(/\bUSDT\b/gi, '')
    .replace(/\bWETH\b/gi, '')
    .replace(/\bWBTC\b/gi, '')
    .replace(/\bDAI\b/gi, '')
    .replace(/\bwei\b/gi, '')
    .replace(/\bgwei\b/gi, '')
    .replace(/\s+/g, '');
  // Optional leading +/-
  const m = cleaned.match(/^([-+]?\d+(\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return isFinite(n) ? n : null;
}

function normaliseHex(s: string): string | null {
  const m = stripJunk(s)
    .toLowerCase()
    .match(/0x[0-9a-f]+/);
  return m ? m[0] : null;
}

/** Exact big-integer compare. Accepts 0x-hex or decimal (commas/underscores ok). For wei-scale values where float loses precision. */
function normaliseBigInt(s: string): bigint | null {
  const c = stripJunk(s).replace(/[, _]/g, '');
  try {
    const hex = c.toLowerCase().match(/0x[0-9a-f]+/);
    if (hex) return BigInt(hex[0]);
    const dec = c.match(/-?\d+/);
    return dec ? BigInt(dec[0]) : null;
  } catch {
    return null;
  }
}

function normaliseAddress(s: string): string | null {
  // Accept full 40-hex or truncated 0xabc...123 form. Return canonical: first 6 + last 4.
  const hex = normaliseHex(s);
  if (!hex) return null;
  if (hex.length === 42) return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
  // Truncated like 0xabc123..def456 — drop dots/ellipsis, keep first and last
  const stripped = hex.replace(/[.…]/g, '');
  if (stripped.length >= 10) return `${stripped.slice(0, 6)}…${stripped.slice(-4)}`;
  return stripped;
}

function normaliseBoolean(s: string): boolean | null {
  const v = stripJunk(s).toLowerCase();
  if (['true', 'yes', 'y', '1', 'correct'].includes(v)) return true;
  if (['false', 'no', 'n', '0', 'incorrect'].includes(v)) return false;
  return null;
}

function normaliseEnum(s: string): string {
  return stripJunk(s).toLowerCase().replace(/\s+/g, '_');
}

function tokenSet(s: string): Set<string> {
  return new Set(
    stripJunk(s)
      .toLowerCase()
      .split(/[^a-z0-9.]+/)
      .filter((t) => t.length > 0),
  );
}

// ---------- main scorer ----------

export function score({ llmAnswer, expected, type }: ScoreInput): ScoreResult {
  if (!llmAnswer || llmAnswer.toUpperCase() === 'UNKNOWN') {
    return { correct: false, normalisedLlm: 'UNKNOWN' };
  }

  for (const exp of expected) {
    if (matches(llmAnswer, exp, type)) {
      return { correct: true, normalisedLlm: llmAnswer.trim(), matchedExpected: exp };
    }
  }
  return { correct: false, normalisedLlm: llmAnswer.trim() };
}

function matches(actual: string, expected: string, type: AnswerType): boolean {
  switch (type) {
    case 'number': {
      const a = toCanonicalNumber(actual);
      const e = toCanonicalNumber(expected);
      if (a === null || e === null) return false;
      const tolerance = Math.max(Math.abs(e) * 0.01, 0.001); // 1% or 0.001
      return Math.abs(a - e) <= tolerance;
    }
    case 'number_signed': {
      const a = toCanonicalNumber(actual);
      const e = toCanonicalNumber(expected);
      if (a === null || e === null) return false;
      if (Math.sign(a) !== Math.sign(e) && Math.abs(a) > 1e-9 && Math.abs(e) > 1e-9) return false;
      const tolerance = Math.max(Math.abs(e) * 0.01, 0.001);
      return Math.abs(a - e) <= tolerance;
    }
    case 'integer': {
      const a = toCanonicalNumber(actual);
      const e = toCanonicalNumber(expected);
      if (a === null || e === null) return false;
      return Math.round(a) === Math.round(e);
    }
    case 'bigint': {
      const a = normaliseBigInt(actual);
      const e = normaliseBigInt(expected);
      return a !== null && e !== null && a === e;
    }
    case 'hex': {
      const a = normaliseHex(actual);
      const e = normaliseHex(expected);
      return a !== null && a === e;
    }
    case 'address': {
      const a = normaliseAddress(actual);
      const e = normaliseAddress(expected);
      return a !== null && a === e;
    }
    case 'boolean': {
      const a = normaliseBoolean(actual);
      const e = normaliseBoolean(expected);
      return a !== null && a === e;
    }
    case 'boolean_enum': {
      // Accept either "yes/no" or an enum like "confirmed/safe/latest". Treat case-insensitively.
      const a = normaliseEnum(actual);
      const e = normaliseEnum(expected);
      return a === e || a.includes(e) || e.includes(a);
    }
    case 'enum': {
      const a = normaliseEnum(actual);
      const e = normaliseEnum(expected);
      return a === e;
    }
    case 'token_set': {
      const a = tokenSet(actual);
      const e = tokenSet(expected);
      // Answer must contain every token of expected (subset check).
      for (const t of e) if (!a.has(t)) return false;
      return e.size > 0;
    }
    case 'freeform': {
      // Last resort: case-insensitive substring match in either direction.
      const a = stripJunk(actual).toLowerCase();
      const e = stripJunk(expected).toLowerCase();
      return a.length > 0 && e.length > 0 && (a.includes(e) || e.includes(a));
    }
  }
}
