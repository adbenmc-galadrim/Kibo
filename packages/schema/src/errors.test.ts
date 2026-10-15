import { expect, test } from "bun:test";
import { isKiboErrorCode, KiboError, parentTicketDetail } from "./errors";

test("a ticket with children is refused with a stable code and a counted detail", () => {
  expect(isKiboErrorCode("TICKET_HAS_CHILDREN")).toBe(true);
  expect(new KiboError("TICKET_HAS_CHILDREN", parentTicketDetail(1)).message).toBe(
    "TICKET_HAS_CHILDREN: ticket has 1 child ticket",
  );
  expect(parentTicketDetail(5)).toBe("ticket has 5 child tickets");
});
