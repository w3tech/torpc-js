/** Small map-mutation helpers used by the per-method mapping rules. */

export type Obj = Record<string, unknown>;

const has = (o: Obj, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Move the value at `from` to `to`. No-op if `from` is absent. */
export function rename(o: Obj, from: string, to: string): void {
  if (!has(o, from)) return;
  o[to] = o[from];
  if (from !== to) delete o[from];
}

/** Delete every listed key. Missing keys are ignored. */
export function drop(o: Obj, ...keys: string[]): void {
  for (const k of keys) delete o[k];
}

/** True for a non-null, non-array object. */
export function isPlainObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
