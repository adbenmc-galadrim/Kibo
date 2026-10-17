import { expect, test } from "bun:test";
import type { PrChecks, PrReview } from "@kibo/schema";
import { detailLines, type TicketDetail } from "./ticket-text";

const pr = (review: PrReview, checks: PrChecks | null) => ({
  number: 20,
  url: "https://github.com/galadrim/emis/pull/20",
  state: "open" as const,
  review,
  checks,
});

const DETAIL: TicketDetail = {
  id: "t",
  key: "EMIS-15",
  planId: null,
  title: "Synchro",
  status: "done",
  kiboStatus: "done",
  column: "Terminé",
  blockedReason: null,
  parent: null,
  children: [],
  deps: [],
  pr: null,
  assignee: null,
  labels: [],
  sprint: null,
  feature: null,
  optional: false,
  delivery: null,
  session: null,
  updatedAt: null,
  refs: [],
  questions: [],
  notes: [],
  brief: null,
  description: "",
};

const lines = (patch: Partial<TicketDetail>) => detailLines({ ...DETAIL, ...patch });

test("shows the session with its local start time", () => {
  const startedAt = new Date(2026, 9, 16, 14, 10).getTime();
  expect(lines({ session: { tool: "T3 Code", startedAt } })).toContain("Session : T3 Code · depuis 14:10");
  expect(lines({}).some((l) => l.startsWith("Session"))).toBe(false);
});

test("shows a touch-up step, not a delivery one", () => {
  const delivery = { step: 7, note: "", at: 1, runId: null, kind: "update" as const };
  expect(lines({ delivery })).toContain("Retouche : 7/11 · Porte qualité");
  expect(lines({ delivery: { ...delivery, kind: "delivery" } }).some((l) => l.startsWith("Retouche"))).toBe(
    false,
  );
});

test("shows the review and the CI of the PR", () => {
  const url = "https://github.com/galadrim/emis/pull/20";
  expect(lines({ pr: pr("changes_requested", "error") })).toContain(
    `PR : #20 (open) · changements demandés · CI rouge · ${url}`,
  );
  expect(lines({ pr: pr("approved", "ok") })).toContain(`PR : #20 (open) · approuvée · CI verte · ${url}`);
  expect(lines({ pr: pr("review_required", "running") })).toContain(`PR : #20 (open) · CI en cours · ${url}`);
  expect(lines({ pr: pr("none", null) })).toContain(`PR : #20 (open) · ${url}`);
  expect(lines({})).toContain("PR : aucune");
});
