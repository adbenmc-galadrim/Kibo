import { expect, test } from "bun:test";
import { EMPTY_DELIVERY } from "@kibo/schema";
import { type DeliverDeps, deliver } from "./deliver";

const deps: DeliverDeps = {
  project: () => ({ delivery: EMPTY_DELIVERY, tickets: [], links: [], questions: [] }),
  agents: () => [],
  orchestrator: { state: () => ({ runs: [] }) },
};

test("a leaf, a parent and a touch-up are all refused", () => {
  for (const ticketId of ["15", "17"])
    expect(() => deliver(deps, { projectId: "p1", ticketId })).toThrow("AGENT_EXECUTION_REMOVED");
  expect(() => deliver(deps, { projectId: "p1", ticketId: "15", mode: "update" })).toThrow(
    "AGENT_EXECUTION_REMOVED",
  );
});
