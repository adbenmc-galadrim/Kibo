import { expect, test } from "bun:test";
import type { GraphEdge } from "./critical-path";
import { collapseGroups, type GroupSpec, groupTickets, labelPrefixes } from "./groups";
import type { WaveTicket } from "./waves";

const ticket = (id: string, labels: string[] = [], patch: Partial<WaveTicket> = {}): WaveTicket => ({
  id,
  key: id,
  statusId: "todo",
  startable: false,
  live: false,
  labels,
  ...patch,
});
const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

test("label prefixes are unique and sorted", () => {
  const tickets = [
    { labels: ["type:bug", "chapitre:C2"] },
    { labels: ["chapitre:C3", "urgent", ":vide", "type:"] },
  ];
  expect(labelPrefixes(tickets)).toEqual(["chapitre", "type"]);
});

test("tickets are grouped by the value of the chosen prefix", () => {
  const tickets = [
    ticket("a", ["chapitre:C10"]),
    ticket("b", ["chapitre:C2"]),
    ticket("c"),
    ticket("d", ["chapitre:C2"]),
  ];
  const spec: GroupSpec = { prefix: "chapitre", collapsed: new Set() };
  const { groups, ungrouped } = groupTickets(tickets, spec);
  expect([...groups.entries()]).toEqual([
    ["C2", ["b", "d"]],
    ["C10", ["a"]],
  ]);
  expect(ungrouped).toEqual(["c"]);
});

const members = Array.from({ length: 8 }, (_, i) =>
  ticket(`c2-${i}`, ["chapitre:C2"], { startable: i === 3, live: i === 5 }),
);
const tickets = [ticket("x"), ...members, ticket("y", ["chapitre:C3"])];
const edges = [
  blocks("x", "c2-0"),
  blocks("x", "c2-1"),
  blocks("c2-0", "c2-1"),
  blocks("c2-7", "y"),
  { from: "c2-2", to: "y", type: "relates" as const },
];

test("a collapsed group becomes one node that carries its members' links", () => {
  const out = collapseGroups(tickets, edges, { prefix: "chapitre", collapsed: new Set(["C2"]) });
  expect(out.tickets.map((t) => t.id)).toEqual(["x", "group:chapitre:C2", "y"]);
  expect(out.tickets[1]).toMatchObject({ key: null, statusId: "todo", startable: true, live: true });
  expect(out.nodeLabels.get("group:chapitre:C2")).toBe("C2 · 8 tickets");
  expect(out.edges).toEqual([
    blocks("x", "group:chapitre:C2"),
    blocks("group:chapitre:C2", "y"),
    { from: "group:chapitre:C2", to: "y", type: "relates" },
  ]);
});

test("a group of done tickets collapses to a done node", () => {
  const done = [ticket("a", ["chapitre:C0"], { statusId: "done" })];
  const out = collapseGroups(done, [], { prefix: "chapitre", collapsed: new Set(["C0"]) });
  expect(out.tickets[0]?.statusId).toBe("done");
  expect(out.nodeLabels.get("group:chapitre:C0")).toBe("C0 · 1 ticket");
});

test("an expanded group leaves its members untouched", () => {
  const out = collapseGroups(tickets, edges, { prefix: "chapitre", collapsed: new Set() });
  expect(out.tickets).toEqual(tickets);
  expect(out.edges).toEqual(edges);
  expect(out.nodeLabels.size).toBe(0);
});
