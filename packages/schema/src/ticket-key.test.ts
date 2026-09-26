import { describe, expect, test } from "bun:test";
import { Ticket, ticketKeyLabel } from "./index";

const base = {
  id: "1@1",
  title: "Schéma Loro",
  description: "",
  statusId: "todo" as const,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
};

describe("ticket key", () => {
  test("a ticket with a key and no pending sequence is valid", () => {
    expect(Ticket.safeParse({ ...base, key: "KIB-12", pendingSeq: null }).success).toBe(true);
  });

  test("a ticket waiting for its key needs a pending sequence", () => {
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: 3 }).success).toBe(true);
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: null }).success).toBe(false);
  });

  test("the pending sequence is a positive integer", () => {
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: 0 }).success).toBe(false);
    expect(Ticket.safeParse({ ...base, key: null, pendingSeq: 1.5 }).success).toBe(false);
  });

  test("the label shows the key, or the project prefix with an ellipsis", () => {
    expect(ticketKeyLabel({ key: "KIB-12" }, "KIB")).toBe("KIB-12");
    expect(ticketKeyLabel({ key: null }, "KIB")).toBe("KIB-…");
  });
});
