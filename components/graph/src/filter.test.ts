import { expect, test } from "bun:test";
import type { Link, TicketView } from "@kibo/schema";
import { domainsOf, graphInput } from "./filter";

const ticket = (id: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key: id,
  title: id,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: { kind: "human", ref: "adam" },
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
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
  const f = { assignee: "mine-and-agents" as const, hideDone: false, domain: null };
  expect(graphInput(tickets, links, f, "adam").tickets.map((t) => t.id)).toEqual(["A", "B", "D"]);
  expect(graphInput(tickets, links, f, "adam").edges).toEqual([
    { from: "A", to: "B", type: "blocks" },
    { from: "A", to: "D", type: "blocks" },
    { from: "B", to: "D", type: "relates" },
  ]);
  expect(graphInput(tickets, links, { ...f, hideDone: true }, "adam").edges).toEqual([
    { from: "A", to: "D", type: "blocks" },
  ]);
  expect(graphInput(tickets, links, { ...f, domain: "Core" }, "adam").tickets.map((t) => t.id)).toEqual([
    "D",
  ]);
  expect(graphInput(tickets, links, { ...f, assignee: "all" }, "adam").tickets).toHaveLength(4);
  expect(domainsOf(tickets)).toEqual(["Core"]);
});
