import { expect, test } from "bun:test";
import type { GithubPrRef, TicketView } from "@kibo/schema";
import { cardProgress, cardSignal } from "./card-signal";

const pr = (over: Partial<GithubPrRef> = {}): GithubPrRef => ({
  kind: "github_pr",
  url: "https://github.com/o/r/pull/20",
  number: 20,
  state: "open",
  base: null,
  head: null,
  review: "none",
  checks: null,
  ...over,
});

const CHANGES = pr({ review: "changes_requested" });
const HOLD: TicketView["onHold"] = { source: "own", key: "SILO-9", reason: "Staging", since: "2026-10-16" };

const ticket = (over: Partial<TicketView> = {}): TicketView =>
  ({
    statusId: "todo",
    externalRefs: [],
    onHold: null,
    waitingOn: [],
    startReason: null,
    delivery: null,
    ...over,
  }) as TicketView;

const QUESTION = { number: 6, importRef: null };

test("priority: blocked > requested changes > held > waiting dependency", () => {
  const all = ticket({ externalRefs: [CHANGES], onHold: HOLD, waitingOn: ["SILO-5"] });
  expect(cardSignal(all, true, QUESTION)).toEqual({ kind: "blocked", question: QUESTION });
  expect(cardSignal(all, false, null)?.kind).toBe("changes");
  expect(cardSignal(ticket({ onHold: HOLD, waitingOn: ["SILO-5"] }), false, null)?.kind).toBe("held");
  expect(cardSignal(ticket({ waitingOn: ["SILO-5"] }), false, null)).toEqual({
    kind: "waiting",
    keys: ["SILO-5"],
  });
  expect(cardSignal(ticket(), false, null)).toBeNull();
});

test("a closed PR asks for no changes", () => {
  const closed = ticket({ externalRefs: [pr({ state: "closed", review: "changes_requested" })] });
  expect(cardSignal(closed, false, null)).toBeNull();
});

test("the waiting signal names the waited keys and those of the start reason, once each", () => {
  const t = ticket({
    waitingOn: ["SILO-51"],
    startReason: { kind: "dependency", keys: ["SILO-51", "SILO-52"] },
  });
  expect(cardSignal(t, false, null)).toEqual({ kind: "waiting", keys: ["SILO-51", "SILO-52"] });
});

test("a sprint or a limit is no signal", () => {
  expect(cardSignal(ticket({ startReason: { kind: "unplanned" } }), false, null)).toBeNull();
});

const STEP9: TicketView["delivery"] = { step: 9, note: "", at: 0, runId: null, kind: "delivery" };

test("PR chip and Étape n/12 for review or in-progress with PR", () => {
  const open = pr();
  for (const statusId of ["in_review", "in_progress"] as const)
    expect(cardProgress(ticket({ statusId, externalRefs: [open], delivery: STEP9 }))).toEqual({
      pr: open,
      delivery: STEP9,
    });
});

test("a PR without any delivery step keeps its chip alone", () => {
  const open = pr();
  expect(cardProgress(ticket({ statusId: "in_review", externalRefs: [open] }))).toEqual({
    pr: open,
    delivery: null,
  });
});

test("no chip without a PR, nor outside review and in-progress", () => {
  expect(cardProgress(ticket({ statusId: "in_review", delivery: STEP9 }))).toBeNull();
  expect(cardProgress(ticket({ statusId: "done", externalRefs: [pr()], delivery: STEP9 }))).toBeNull();
  expect(cardProgress(ticket({ statusId: "todo", externalRefs: [pr()] }))).toBeNull();
});
