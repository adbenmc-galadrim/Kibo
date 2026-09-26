import type { CiRun } from "./integrations";

export type CiTone = "ok" | "error" | "running" | "neutral";
type RunState = Pick<CiRun, "status" | "conclusion">;

const FAILED: ReadonlySet<string> = new Set(["failure", "timed_out", "startup_failure"]);
const SEVERITY: Record<CiTone, number> = { neutral: 0, ok: 1, running: 2, error: 3 };

export function ciTone(run: RunState): CiTone {
  if (run.status !== "completed") return "running";
  if (run.conclusion === "success") return "ok";
  if (run.conclusion !== null && FAILED.has(run.conclusion)) return "error";
  return "neutral";
}

export function latestCiRunPerWorkflow(runs: readonly CiRun[]): CiRun[] {
  const byName = new Map<string, CiRun>();
  for (const r of runs) {
    const prev = byName.get(r.workflow);
    if (!prev || prev.updatedAt < r.updatedAt) byName.set(r.workflow, r);
  }
  return [...byName.values()].sort((a, b) => a.workflow.localeCompare(b.workflow));
}

export function worstCiTone(runs: readonly CiRun[]): CiTone | null {
  let worst: CiTone | null = null;
  for (const r of latestCiRunPerWorkflow(runs)) {
    const tone = ciTone(r);
    if (worst === null || SEVERITY[tone] > SEVERITY[worst]) worst = tone;
  }
  return worst;
}
