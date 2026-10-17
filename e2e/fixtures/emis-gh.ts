import {
  EMIS_LOOSE_TICKETS,
  emisSteps,
  type PrChecksSpec,
  type PrReviewSpec,
  type PrSpec,
  prUrl,
} from "./emis-maquettes";
import { EMIS_CLOSING } from "./emis-suivi";

export type FakeGhPr = {
  number: number;
  url: string;
  state: "OPEN" | "MERGED";
  isDraft: boolean;
  reviewDecision: string;
  statusCheckRollup: { status: string; conclusion: string | null }[];
};

const REVIEW_DECISIONS: Record<PrReviewSpec, string> = {
  none: "",
  approved: "APPROVED",
  changes_requested: "CHANGES_REQUESTED",
};
const ROLLUPS: Record<PrChecksSpec, FakeGhPr["statusCheckRollup"]> = {
  ok: [{ status: "COMPLETED", conclusion: "SUCCESS" }],
  error: [{ status: "COMPLETED", conclusion: "FAILURE" }],
  running: [{ status: "IN_PROGRESS", conclusion: null }],
};

const isFollowed = (pr: PrSpec): boolean => pr.state === "open" || pr.number === EMIS_CLOSING.merged;

export function emisGhState(options: { merged: boolean }): FakeGhPr[] {
  const prs = [...emisSteps(), ...EMIS_LOOSE_TICKETS].flatMap((s) =>
    s.pr !== undefined && isFollowed(s.pr) ? [s.pr] : [],
  );
  return prs.map((pr) => ({
    number: pr.number,
    url: prUrl(pr.number),
    state: options.merged && pr.number === EMIS_CLOSING.merged ? "MERGED" : "OPEN",
    isDraft: false,
    reviewDecision: REVIEW_DECISIONS[pr.review],
    statusCheckRollup: ROLLUPS[pr.checks],
  }));
}
