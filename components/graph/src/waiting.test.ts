import { expect, test } from "bun:test";
import type { GraphEdge, GraphTicket } from "./critical-path";
import { readyTickets, waitingOn } from "./waiting";

const t = (id: string, statusId: GraphTicket["statusId"]): GraphTicket => ({ id, key: id, statusId });
const tickets = [t("A", "done"), t("B", "in_progress"), t("C", "todo"), t("D", "todo"), t("E", "blocked")];
const edges: GraphEdge[] = [
  { from: "A", to: "B", type: "blocks" },
  { from: "B", to: "C", type: "blocks" },
  { from: "B", to: "D", type: "blocks" },
  { from: "C", to: "D", type: "relates" },
];

test("waitingOn lists unfinished tickets with their unfinished blocks predecessors, sorted by key", () => {
  expect([...waitingOn(tickets, edges)]).toEqual([
    ["C", ["B"]],
    ["D", ["B"]],
  ]);
});

test("readyTickets are unfinished tickets whose predecessors are all finished (or absent)", () => {
  expect(readyTickets(tickets, edges)).toEqual(["B", "E"]);
});

test("waitingOn sorts blockers by ticket key, not by id, and ignores duplicate edges", () => {
  const keyed: GraphTicket[] = [
    { id: "z", key: "KIB-2", statusId: "todo" },
    { id: "a", key: "KIB-10", statusId: "todo" },
    { id: "m", key: "KIB-30", statusId: "todo" },
  ];
  const blocks = (from: string): GraphEdge => ({ from, to: "m", type: "blocks" });
  expect(waitingOn(keyed, [blocks("a"), blocks("z"), blocks("z")]).get("m")).toEqual(["z", "a"]);
});
