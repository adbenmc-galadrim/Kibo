import { expect, test } from "bun:test";
import type { Link, TicketView } from "@kibo/schema";
import { EMPTY_PROGRESS } from "@kibo/schema";
import { graphInput } from "./filter";

const ticket = (id: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key: id,
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
  thread: null,
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

test("« Moi + agents » keeps the viewer's and the agents' tickets, done ones never, and the edges between them", () => {
  const tickets = [
    ticket("A"),
    ticket("B", { statusId: "done" }),
    ticket("C", { assignee: { kind: "human", ref: "lea" } }),
    ticket("D", { assignee: { kind: "agent", ref: "opus-dev" } }),
    ticket("E", { assignee: null }),
  ];
  const links = [link("A", "B"), link("A", "C"), link("A", "D"), link("D", "E", "relates")];
  const mine = graphInput(tickets, links, "mine-and-agents", "adam");
  expect(mine.tickets.map((t) => t.id)).toEqual(["A", "D"]);
  expect(mine.edges).toEqual([{ from: "A", to: "D", type: "blocks" }]);
  const all = graphInput(tickets, links, "all", "adam");
  expect(all.tickets.map((t) => t.id)).toEqual(["A", "C", "D", "E"]);
  expect(all.edges).toEqual([
    { from: "A", to: "C", type: "blocks" },
    { from: "A", to: "D", type: "blocks" },
    { from: "D", to: "E", type: "relates" },
  ]);
});

test("a group is kept whoever it is assigned to, unless it is done", () => {
  const progress = { done: 1, total: 2 };
  const tickets = [
    ticket("G", { assignee: { kind: "human", ref: "lea" }, progress }),
    ticket("H", { statusId: "done", progress }),
  ];
  expect(graphInput(tickets, [], "mine-and-agents", "adam").tickets.map((t) => t.id)).toEqual(["G"]);
});
