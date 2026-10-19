import { expect, test } from "bun:test";
import { type DeliveryOrderTicket, deliveryOrder, deliveryTicketsOf } from "./delivery-order";
import type { Link } from "./link";

const ticket = (id: string, rank: number, over: Partial<DeliveryOrderTicket> = {}): DeliveryOrderTicket => ({
  id,
  key: `SILO-${id}`,
  title: `Ticket ${id}`,
  parentId: "17",
  statusId: "todo",
  startable: false,
  rank,
  openBlockingQuestions: 0,
  ...over,
});

const TICKETS: DeliveryOrderTicket[] = [
  ticket("17", 0, { parentId: null }),
  ticket("18", 1, { startable: true }),
  ticket("19", 2),
  ticket("20", 3, { statusId: "done" }),
  ticket("21", 4, { openBlockingQuestions: 1 }),
  ticket("22", 5),
  ticket("23", 6),
  ticket("24", 7, { parentId: "23", startable: true }),
  ticket("30", 8, { parentId: null, startable: true }),
];
const LINKS: Pick<Link, "from" | "to" | "type">[] = [
  { from: "18", to: "19", type: "blocks" },
  { from: "20", to: "21", type: "relates" },
];

test("the leaves of a parent come in dependency order, with their readiness", () => {
  const items = deliveryOrder({ tickets: TICKETS, links: LINKS, busy: new Set(["22"]), parentId: "17" });
  expect(items.map((i) => i.key)).toEqual(["SILO-18", "SILO-19", "SILO-20", "SILO-21", "SILO-22", "SILO-24"]);
  expect(items.filter((i) => i.ready).map((i) => i.key)).toEqual(["SILO-18", "SILO-24"]);
  const reason = Object.fromEntries(items.map((i) => [i.key, i.reason]));
  expect(reason).toEqual({
    "SILO-18": null,
    "SILO-19": "blocked",
    "SILO-20": "done",
    "SILO-21": "question",
    "SILO-22": "busy",
    "SILO-24": null,
  });
  expect(items.find((i) => i.key === "SILO-19")?.blockedBy).toEqual(["SILO-18"]);
  expect(items.find((i) => i.key === "SILO-18")?.blockedBy).toEqual([]);
});

test("a blocker comes first even when its rank is later", () => {
  const tickets = [ticket("17", 0, { parentId: null }), ticket("1", 1), ticket("2", 2, { startable: true })];
  const items = deliveryOrder({
    tickets,
    links: [{ from: "2", to: "1", type: "blocks" }],
    busy: new Set(),
    parentId: "17",
  });
  expect(items.map((i) => i.ticketId)).toEqual(["2", "1"]);
});

test("a ticket already started gives the status reason, a done blocker no longer blocks", () => {
  const tickets = [
    ticket("17", 0, { parentId: null }),
    ticket("1", 1, { statusId: "done" }),
    ticket("2", 2, { startable: true }),
    ticket("3", 3, { statusId: "in_progress" }),
  ];
  const items = deliveryOrder({
    tickets,
    links: [{ from: "1", to: "2", type: "blocks" }],
    busy: new Set(),
    parentId: "17",
  });
  expect(items.map((i) => [i.ticketId, i.reason, i.blockedBy])).toEqual([
    ["1", "done", []],
    ["2", null, []],
    ["3", "status", []],
  ]);
});

test("a ticket without children has nothing to deliver below it", () => {
  expect(deliveryOrder({ tickets: TICKETS, links: LINKS, busy: new Set(), parentId: "18" })).toEqual([]);
});

test("the snapshot gives the rank and the open blocking questions", () => {
  const question = (ticketId: string, blocking: boolean, archivedAt: number | null) => ({
    ticketId,
    blocking,
    answer: null,
    archivedAt,
  });
  const tickets = deliveryTicketsOf({
    tickets: [ticket("a", 9), ticket("b", 9)],
    questions: [question("b", true, null), question("b", false, null), question("a", true, 5)],
  });
  expect(tickets.map((t) => [t.id, t.rank, t.openBlockingQuestions])).toEqual([
    ["a", 0, 0],
    ["b", 1, 1],
  ]);
});
