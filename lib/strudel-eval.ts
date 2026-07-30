// Common JS methods/globals that legitimately appear, so we don't flag them.
export interface DeepResult {
  ok: boolean | null; // null = engine unavailable, skip
  errors: string[];
  warnings: string[];
}
