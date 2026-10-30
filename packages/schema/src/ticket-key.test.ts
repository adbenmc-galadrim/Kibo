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
  test("a ticket has a key, an old one still waiting for its key parses", () => {
    expect(Ticket.safeParse({ ...base, key: "KIB-12" }).success).toBe(true);
    expect(Ticket.safeParse({ ...base, key: null }).success).toBe(true);
  });

  test("the label shows the key, or the project prefix with an ellipsis", () => {
    expect(ticketKeyLabel({ key: "KIB-12" }, "KIB")).toBe("KIB-12");
    expect(ticketKeyLabel({ key: null }, "KIB")).toBe("KIB-…");
  });
});
