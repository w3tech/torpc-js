/**
 * A method mapper transforms the `result` payload of one (or several) RPC
 * methods in both directions. Modules implement this; the registry indexes
 * them by method name for the dispatch layer.
 */
export interface MethodMapper {
  /** RPC method names this mapper handles. */
  readonly methods: readonly string[];
  /** standard `result` → compact `result`. */
  forwardResult(result: unknown): unknown;
  /** compact `result` → standard `result`. */
  backwardResult(result: unknown): unknown;
}
