import { expect, test } from "bun:test";
import type { ProposedAction } from "@kibo/schema";
import { AGENTS, project, ticket } from "./test-kit";
import { type BatchContext, validateBatch } from "./validate";

const snapshot = project({
  tickets: [
    ticket({ id: "t1", title: "Regroupement" }),
    ...[2, 3, 4, 5, 6].map((n) => ticket({ id: `t${n}`, parentId: "t1" })),
    ticket({ id: "t7" }),
  ],
});

const ctx = (p: Partial<BatchContext> = {}): BatchContext => ({
  project: snapshot,
  runs: [],
  notes: [],
  agents: AGENTS,
  demoProject: false,
  viewer: "adam",
  signals: [],
  closedSignals: [],
  agentExecution: "shown",
  ...p,
});

const why = "";
const problems = (actions: ProposedAction[], c = ctx()) => {
  const result = validateBatch({ summary: "Lot", actions }, c);
  return result.ok ? [] : result.problems.map((p) => `#${p.actionId} ${p.message}`);
};
const assign = (ticketRef: string, profileId: string, id = 1): ProposedAction => ({
  id,
  why,
  type: "assignAgent",
  ticket: ticketRef,
  profileId,
});

test("a parent ticket is never assigned, whatever the agent", () => {
  for (const profileId of ["global:opus-dev", "system:demo", "nope"]) {
    expect(problems([assign("SILO-1", profileId)], ctx({ demoProject: true }))).toEqual([
      "#1 ce ticket regroupe 5 sous-tickets : lance les sous-tickets",
    ]);
  }
  expect(problems([assign("SILO-2", "global:opus-dev")])).toEqual([]);
});

test("a child the batch gives the ticket counts, before or after the assignment", () => {
  const child = (id: number, parent: string): ProposedAction => ({
    id,
    why,
    type: "createTicket",
    ref: `new:${id}`,
    title: "Sous",
    parent,
  });
  const refused = ["#2 ce ticket regroupe 1 sous-ticket : lance les sous-tickets"];
  expect(problems([child(1, "SILO-7"), assign("SILO-7", "global:opus-dev", 2)])).toEqual(refused);
  expect(problems([assign("SILO-7", "global:opus-dev", 2), child(1, "SILO-7")])).toEqual(refused);
  expect(
    problems([
      { id: 1, why, type: "updateTicket", ticket: "SILO-2", parent: "SILO-7" },
      assign("SILO-7", "global:opus-dev", 2),
    ]),
  ).toEqual(refused);
});
