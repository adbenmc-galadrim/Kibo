import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { isTicketRun, refuseTicketExecution } from "./execution-removed";

test("only a run tied to a ticket is a ticket run", () => {
  expect(isTicketRun({ kind: "ticket", ticketId: "t1" })).toBe(true);
  expect(isTicketRun({ kind: "ticket", ticketId: null })).toBe(false);
  expect(isTicketRun({ kind: "project", ticketId: null })).toBe(false);
});

test("the refusal carries the stable code and names what was refused", () => {
  const refused = (() => {
    try {
      refuseTicketExecution("deliver");
    } catch (e) {
      return e;
    }
    return null;
  })();
  expect(refused).toBeInstanceOf(KiboError);
  expect(refused).toMatchObject({ code: "AGENT_EXECUTION_REMOVED" });
  expect(refused instanceof KiboError && refused.detail.startsWith("deliver: ")).toBe(true);
});
