import { expect, test } from "bun:test";
import { assigneeOf } from "./ticket-facts";

test("a 0.21 demo assignee reads as kibo-demo without rewriting the ticket", () => {
  const ticket = { assignee: { kind: "agent" as const, ref: "demo" } };
  expect(assigneeOf(ticket)).toBe("kibo-demo");
  expect(ticket.assignee.ref).toBe("demo");
  expect(assigneeOf({ assignee: { kind: "agent", ref: "kibo-demo" } })).toBe("kibo-demo");
  expect(assigneeOf({ assignee: { kind: "human", ref: "demo" } })).toBe("demo");
  expect(assigneeOf({ assignee: { kind: "agent", ref: "livraison" } })).toBe("livraison");
  expect(assigneeOf({ assignee: null })).toBeNull();
});
