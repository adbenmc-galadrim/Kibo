export type Comparison = { kind: "passed" } | { kind: "failed"; error: unknown };
export type Outcome = { kind: "exact" } | { kind: "diff"; path: string };

export function comparisonOutcome(comparison: Comparison, diffPath: string | null): Outcome {
  if (comparison.kind === "passed") return { kind: "exact" };
  if (diffPath === null) throw comparison.error;
  return { kind: "diff", path: diffPath };
}
