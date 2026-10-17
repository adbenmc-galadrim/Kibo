import { expect, test } from "bun:test";
import type { Batch, ProposedAction } from "@kibo/schema";
import { sprintProposal } from "./sprint-proposal";

const batch = (actions: ProposedAction[], patch: Partial<Batch> = {}): Batch => ({
  id: "b7",
  projectId: "emis",
  runId: "pa1",
  sessionId: "s-pa1",
  seq: 7,
  summary: "Fin de S42",
  actions,
  expected: [],
  createdAt: 0,
  status: "pending",
  decidedBy: null,
  decidedAt: null,
  chosen: null,
  comment: null,
  results: [],
  ...patch,
});
const setSprint = (id: number, ticket: string, sprint: string | null): ProposedAction => ({
  id,
  why: "4 étapes restantes",
  type: "setSprint",
  ticket,
  sprint,
});

test("a pending batch that moves the feature gives the proposal and its action", () => {
  const batches = [batch([setSprint(1, "EMIS-90", "S44"), setSprint(2, "EMIS-30", "S43")])];
  expect(sprintProposal(batches, "EMIS-30")).toEqual({ batchId: "b7", actionId: 2, sprint: "S43" });
});

test("no proposal from a decided batch, for another feature, or to take it off the planning", () => {
  expect(
    sprintProposal([batch([setSprint(1, "EMIS-30", "S43")], { status: "superseded" })], "EMIS-30"),
  ).toBeNull();
  expect(sprintProposal([batch([setSprint(1, "EMIS-90", "S43")])], "EMIS-30")).toBeNull();
  expect(sprintProposal([batch([setSprint(1, "EMIS-30", null)])], "EMIS-30")).toBeNull();
  expect(sprintProposal([batch([setSprint(1, "EMIS-30", "S43")])], null)).toBeNull();
});

test("no proposal once its action is decided in a batch still pending", () => {
  const decided = batch([setSprint(1, "EMIS-30", "S43"), setSprint(2, "EMIS-90", "S44")], { chosen: [1] });
  expect(sprintProposal([decided], "EMIS-30")).toBeNull();
  expect(sprintProposal([decided], "EMIS-90")).toEqual({ batchId: "b7", actionId: 2, sprint: "S44" });
});
