import { expect, test } from "bun:test";
import type { Link, TicketView } from "@kibo/schema";
import { EMPTY_PROGRESS } from "@kibo/schema";
import { domainsOf, graphInput, initialFilter } from "./filter";

const ticket = (id: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key: id,
  pendingSeq: null,
  hold: null,
  keyLabel: id,
  title: id,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: { kind: "human", ref: "adam" },
  parentId: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
  ...patch,
});
const link = (from: string, to: string, type: Link["type"] = "blocks"): Link => ({
  id: `${from}-${to}`,
  from,
  to,
  type,
});

test("assignee, done and domain filters drop tickets and the edges that touch them", () => {
  const tickets = [
    ticket("A"),
    ticket("B", { statusId: "done" }),
    ticket("C", { assignee: { kind: "human", ref: "lea" } }),
    ticket("D", { assignee: { kind: "agent", ref: "opus-dev" }, domainId: "Core" }),
  ];
  const links = [link("A", "B"), link("A", "C"), link("A", "D"), link("B", "D", "relates")];
  const f = { assignee: "mine-and-agents" as const, showDone: true, startable: false, domain: null };
  expect(graphInput(tickets, links, f, "adam").tickets.map((t) => t.id)).toEqual(["A", "B", "D"]);
  expect(graphInput(tickets, links, f, "adam").edges).toEqual([
    { from: "A", to: "B", type: "blocks" },
    { from: "A", to: "D", type: "blocks" },
    { from: "B", to: "D", type: "relates" },
  ]);
  expect(graphInput(tickets, links, { ...f, showDone: false }, "adam").edges).toEqual([
    { from: "A", to: "D", type: "blocks" },
  ]);
  expect(graphInput(tickets, links, { ...f, domain: "Core" }, "adam").tickets.map((t) => t.id)).toEqual([
    "D",
  ]);
  expect(graphInput(tickets, links, { ...f, assignee: "all" }, "adam").tickets).toHaveLength(4);
  expect(domainsOf(tickets)).toEqual(["Core"]);
});

test("the startable filter keeps only tickets that can start now", () => {
  const tickets = [ticket("A", { startable: true }), ticket("B"), ticket("C", { startable: true })];
  const links = [link("A", "B"), link("A", "C")];
  const f = { assignee: "all" as const, showDone: false, startable: true, domain: null };
  const input = graphInput(tickets, links, f, "adam");
  expect(input.tickets.map((t) => t.id)).toEqual(["A", "C"]);
  expect(input.edges).toEqual([{ from: "A", to: "C", type: "blocks" }]);
});

test("done tickets are hidden by default; the former hideDone key is tolerated, showDone decides", () => {
  expect(initialFilter({})).toEqual({
    assignee: "mine-and-agents",
    showDone: false,
    startable: false,
    domain: null,
  });
  expect(initialFilter({ filter: "all" }).assignee).toBe("all");
  expect(initialFilter({ hideDone: true }).showDone).toBe(false);
  expect(initialFilter({ hideDone: false }).showDone).toBe(false);
  expect(initialFilter({ showDone: true, hideDone: true }).showDone).toBe(true);
  expect(initialFilter({ showDone: "yes" }).showDone).toBe(false);
});
