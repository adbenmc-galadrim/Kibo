import type { CiRun } from "@kibo/schema";
import { fr } from "../../i18n/fr";

export type RunTone = "ok" | "error" | "running" | "neutral";
type RunState = Pick<CiRun, "status" | "conclusion">;

const pad = (n: number) => String(n).padStart(2, "0");
const FAILED = new Set(["failure", "timed_out", "startup_failure"]);
const WAITING = new Set(["queued", "waiting", "pending", "requested"]);

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${pad(Math.floor((s % 3600) / 60))} min`;
}

export function runTone(run: RunState): RunTone {
  if (run.status !== "completed") return "running";
  if (run.conclusion === "success") return "ok";
  if (run.conclusion !== null && FAILED.has(run.conclusion)) return "error";
  return "neutral";
}

export function conclusionLabel(run: RunState): string {
  const labels: Record<string, string> = fr.integrations.sheet.conclusion;
  if (WAITING.has(run.status)) return fr.integrations.sheet.conclusion.queued;
  if (run.status !== "completed") return fr.integrations.sheet.conclusion.running;
  const key = run.conclusion ?? "neutral";
  return labels[key] ?? key;
}

export function runDuration(run: CiRun): string | null {
  const end = run.jobs
    .map((j) => j.completedAt)
    .filter((x): x is string => x !== null)
    .sort()
    .at(-1);
  if (!run.startedAt || !end || run.status !== "completed") return null;
  return formatDuration(Date.parse(end) - Date.parse(run.startedAt));
}

export function latestPerWorkflow(runs: CiRun[]): CiRun[] {
  const byName = new Map<string, CiRun>();
  for (const r of runs) {
    const prev = byName.get(r.workflow);
    if (!prev || prev.updatedAt < r.updatedAt) byName.set(r.workflow, r);
  }
  return [...byName.values()].sort((a, b) => a.workflow.localeCompare(b.workflow));
}
