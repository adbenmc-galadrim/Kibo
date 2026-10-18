import { expect, test } from "bun:test";
import { type Agent, EMPTY_DELIVERY, KiboError, type ProjectDelivery, type RunView } from "@kibo/schema";
import { testAgent } from "../agents/agents-port.test-helper";
import type { TicketExecution } from "../agents/execution-removed";
import type { AssignInput } from "../agents/orchestrator-types";
import { runView } from "../questions/questions.test-helper";
import { type DeliverDeps, type DeliveryProject, deliver, NO_DELIVERY_AGENT } from "./deliver";

type Row = DeliveryProject["tickets"][number];

const row = (id: string, over: Partial<Row> = {}): Row => ({
  id,
  key: `EMIS-${id}`,
  title: `Ticket ${id}`,
  parentId: null,
  statusId: "todo",
  startable: true,
  ...over,
});

const TICKETS: Row[] = [
  row("15"),
  row("16", { statusId: "done" }),
  row("17"),
  row("18", { parentId: "17" }),
  row("19", { parentId: "17", startable: false }),
  row("20", { parentId: "17" }),
  row("21", { key: null }),
];

const fullDelivery = (enabled = true) => testAgent({ id: "full-delivery", name: "full-delivery", enabled });

type RigOptions = {
  agents?: Agent[];
  delivery?: ProjectDelivery | null;
  runs?: RunView[];
  ticketExecution?: TicketExecution;
};

function rig(over: RigOptions = {}) {
  const assigned: AssignInput[] = [];
  const project: DeliveryProject = {
    delivery: over.delivery === undefined ? EMPTY_DELIVERY : over.delivery,
    tickets: TICKETS,
    links: [{ from: "18", to: "19", type: "blocks" }],
    questions: [],
  };
  const deps: DeliverDeps = {
    project: () => project,
    agents: () => over.agents ?? [fullDelivery()],
    orchestrator: {
      ticketExecution: () => over.ticketExecution ?? "allowed",
      state: () => ({ runs: over.runs ?? [] }),
      assign(input) {
        assigned.push(input);
        return runView({
          id: "r1",
          ticketId: input.ticketId,
          profileId: input.profileId,
          brief: input.brief,
        });
      },
    },
  };
  return { deps, assigned };
}

test("a leaf is assigned to the delivery agent with the brief written by Kibo", () => {
  const { deps, assigned } = rig();
  const result = deliver(deps, { projectId: "p1", ticketId: "15" });
  expect(assigned).toEqual([
    {
      projectId: "p1",
      ticketId: "15",
      profileId: "global:full-delivery",
      brief: "/full-delivery EMIS-15",
      fresh: false,
    },
  ]);
  expect(result).toMatchObject({ id: "r1", brief: "/full-delivery EMIS-15" });
});

test("the project's delivery agent wins over the global full-delivery agent", () => {
  const own = testAgent({ id: "livreur", name: "livreur", projectId: "p1" });
  const { deps, assigned } = rig({
    agents: [fullDelivery(), own],
    delivery: { ...EMPTY_DELIVERY, agent: own.ref },
  });
  deliver(deps, { projectId: "p1", ticketId: "15" });
  expect(assigned.map((a) => a.profileId)).toEqual(["project:p1:livreur"]);
});

test("a parent never starts a run: its ready sub-tickets come back in dependency order", () => {
  const busy = runView({ id: "r9", ticketId: "20", state: "running" });
  const { deps, assigned } = rig({ runs: [busy] });
  const result = deliver(deps, { projectId: "p1", ticketId: "17" });
  expect(assigned).toEqual([]);
  if (result.kind !== "parent") throw new Error("expected the sub-tickets of the parent");
  expect(result.items.map((i) => [i.key, i.ready, i.reason])).toEqual([
    ["EMIS-18", true, null],
    ["EMIS-19", false, "blocked"],
    ["EMIS-20", false, "busy"],
  ]);
  expect(result.items.find((i) => i.key === "EMIS-19")?.blockedBy).toEqual(["EMIS-18"]);
});

test("without a delivery agent nothing is delivered, leaf or parent", () => {
  for (const agents of [[], [fullDelivery(false)]]) {
    const { deps, assigned } = rig({ agents });
    for (const ticketId of ["15", "17"]) {
      expect(() => deliver(deps, { projectId: "p1", ticketId })).toThrow(
        new KiboError("AGENT_NOT_FOUND", NO_DELIVERY_AGENT),
      );
    }
    expect(assigned).toEqual([]);
  }
  expect(NO_DELIVERY_AGENT).toBe("aucun agent de livraison : choisis-le dans Modifier le projet");
});

test("a done ticket, a ticket without key or an unknown ticket is refused before any run", () => {
  const { deps, assigned } = rig();
  expect(() => deliver(deps, { projectId: "p1", ticketId: "16" })).toThrow(
    expect.objectContaining({ code: "INVALID_TRANSITION" }),
  );
  expect(() => deliver(deps, { projectId: "p1", ticketId: "21" })).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
  expect(() => deliver(deps, { projectId: "p1", ticketId: "99" })).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  expect(assigned).toEqual([]);
});

test("an active run on the leaf is refused by assign itself", () => {
  const { deps } = rig();
  deps.orchestrator.assign = () => {
    throw new KiboError("CONFLICT", "ticket EMIS-15 already has an active run");
  };
  expect(() => deliver(deps, { projectId: "p1", ticketId: "15" })).toThrow(
    expect.objectContaining({ code: "CONFLICT" }),
  );
});

test("a touch-up delivers a done ticket with the update-delivery brief", () => {
  const { deps, assigned } = rig();
  deliver(deps, { projectId: "p1", ticketId: "16", mode: "update" });
  expect(assigned).toEqual([
    {
      projectId: "p1",
      ticketId: "16",
      profileId: "global:full-delivery",
      brief: "/update-delivery EMIS-16",
      fresh: false,
    },
  ]);
  expect(TICKETS.find((t) => t.id === "16")?.statusId).toBe("done");
});

test("without the update mode, a done ticket stays refused", () => {
  const { deps, assigned } = rig();
  expect(() => deliver(deps, { projectId: "p1", ticketId: "16", mode: "delivery" })).toThrow(
    expect.objectContaining({ code: "INVALID_TRANSITION" }),
  );
  expect(assigned).toEqual([]);
});

test("a touch-up refuses a ticket with sub-tickets", () => {
  const { deps, assigned } = rig();
  expect(() => deliver(deps, { projectId: "p1", ticketId: "17", mode: "update" })).toThrow(
    expect.objectContaining({ code: "TICKET_HAS_CHILDREN" }),
  );
  expect(assigned).toEqual([]);
});

test("without ticket execution a leaf and a parent are both refused, nothing is assigned or listed", () => {
  const { deps, assigned } = rig({ ticketExecution: "removed" });
  for (const ticketId of ["15", "17"])
    expect(() => deliver(deps, { projectId: "p1", ticketId })).toThrow("AGENT_EXECUTION_REMOVED");
  expect(() => deliver(deps, { projectId: "p1", ticketId: "15", mode: "update" })).toThrow(
    "AGENT_EXECUTION_REMOVED",
  );
  expect(assigned).toEqual([]);
});
