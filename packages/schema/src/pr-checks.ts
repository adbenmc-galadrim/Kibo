import { type CiTone, worstCiTone } from "./ci-state";
import type { GithubPrRef, PrChecks, PrReview } from "./external-ref";
import type { CiRun } from "./integrations";

export type CheckRollupItem = {
  status?: string;
  conclusion?: string | null;
  state?: string;
  name?: string;
};

const FAILING: ReadonlySet<string> = new Set(["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED"]);
const RUNNING: ReadonlySet<string> = new Set(["IN_PROGRESS", "QUEUED", "PENDING", "EXPECTED"]);
const REVIEWS: Readonly<Record<string, PrReview>> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REVIEW_REQUIRED: "review_required",
};

const failed = (item: CheckRollupItem): boolean =>
  FAILING.has(item.conclusion ?? "") || FAILING.has(item.state ?? "");
const running = (item: CheckRollupItem): boolean =>
  RUNNING.has(item.status ?? "") || RUNNING.has(item.state ?? "");

export function prChecksTone(rollup: readonly CheckRollupItem[]): PrChecks | null {
  if (rollup.length === 0) return null;
  if (rollup.some(failed)) return "error";
  return rollup.some(running) ? "running" : "ok";
}

export const failedCheckName = (rollup: readonly CheckRollupItem[]): string | null =>
  rollup.find(failed)?.name ?? null;

export function parseReviewDecision(raw: unknown): PrReview {
  return typeof raw === "string" && Object.hasOwn(REVIEWS, raw) ? (REVIEWS[raw] ?? "none") : "none";
}

export function prCiTone(pr: Pick<GithubPrRef, "number" | "checks">, runs: readonly CiRun[]): CiTone | null {
  const own = runs.filter((r) => r.prNumber === pr.number);
  return own.length > 0 ? worstCiTone(own) : pr.checks;
}
