import { expect, test } from "bun:test";
import { isKiboErrorCode, KiboError, parentTicketDetail } from "./errors";

test("a ticket with children is refused with a stable code and a counted detail", () => {
  expect(isKiboErrorCode("TICKET_HAS_CHILDREN")).toBe(true);
  expect(new KiboError("TICKET_HAS_CHILDREN", parentTicketDetail(1)).message).toBe(
    "TICKET_HAS_CHILDREN: ce ticket regroupe 1 sous-ticket",
  );
  expect(parentTicketDetail(5)).toBe("ce ticket regroupe 5 sous-tickets");
});
