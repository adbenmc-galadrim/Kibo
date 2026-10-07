import { expect, test } from "bun:test";
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
