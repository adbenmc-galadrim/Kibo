import { expect, test } from "bun:test";
import { EMPTY_PROGRESS } from "./progress";
import { Ticket } from "./ticket";

test("a ticket without labels parses to an empty list and labels are validated", () => {
  const base = {
    id: "t1",
    key: "KIB-1",
    pendingSeq: null,
    title: "x",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  };
  expect(Ticket.parse(base).labels).toEqual([]);
  expect(Ticket.safeParse({ ...base, labels: ["Bad"] }).success).toBe(false);
});

test("a ticket without agent progress parses to the empty progress", () => {
  const ticket = Ticket.parse({
    id: "t1",
    key: "KIB-1",
    pendingSeq: null,
    title: "x",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  });
  expect(ticket.agentProgress).toEqual(EMPTY_PROGRESS);
});

test("a ticket without delivery step has none, a stored step is validated", () => {
  const base = {
    id: "t1",
    key: "KIB-1",
    pendingSeq: null,
    title: "x",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  };
  expect(Ticket.parse(base).delivery).toBeNull();
  const delivery = { step: 7, note: "porte qualité", at: 1, runId: "r1" };
  expect(Ticket.parse({ ...base, delivery }).delivery).toEqual({ ...delivery, kind: "delivery" });
  expect(Ticket.safeParse({ ...base, delivery: { ...delivery, step: 12 } }).success).toBe(false);
});

test("a ticket has no sprint, is mandatory and has no short key by default", () => {
  const base = {
    id: "t1",
    key: "KIB-1",
    pendingSeq: null,
    title: "x",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  };
  const ticket = Ticket.parse(base);
  expect(ticket.sprintId).toBeNull();
  expect(ticket.optional).toBe(false);
  expect(ticket.shortKey).toBeNull();
  expect(Ticket.parse({ ...base, sprintId: "s42", optional: true, shortKey: "F5" })).toMatchObject({
    sprintId: "s42",
    optional: true,
    shortKey: "F5",
  });
  expect(Ticket.safeParse({ ...base, shortKey: "f5" }).success).toBe(false);
  expect(Ticket.safeParse({ ...base, sprintId: "" }).success).toBe(false);
});
