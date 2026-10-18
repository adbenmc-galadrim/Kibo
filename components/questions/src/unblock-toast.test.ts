import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { answer, question, ticket } from "./question-fixtures.test-helper";
import { unblockedFeatures } from "./unblock-toast";

const F6 = ticket("f6", "F6", { shortKey: "F6" });
const STEP = ticket("t51", "EMIS-51", { parentId: "f6" });
const STUCK = ticket("t52", "EMIS-52", { parentId: "f6", statusId: "blocked" });
const LOOSE = ticket("t9", "EMIS-9");
const TICKETS = [F6, STEP, STUCK, LOOSE];
const byId = new Map<string, TicketView>(TICKETS.map((t) => [t.id, t]));
const ticketOf = (id: string) => byId.get(id) ?? null;

const open = question({ id: "q14", ticketId: "t51", blocking: true });
const done = { ...open, answer: answer(9) };

test("an answer that unblocks a step of F6 reports F6", () => {
  expect(unblockedFeatures(TICKETS, ticketOf, [open], [done])).toEqual(["F6"]);
});

test("nothing is reported while the ticket stays blocked or was never blocked", () => {
  const onStuck = question({ id: "q1", ticketId: "t52", blocking: true });
  expect(unblockedFeatures(TICKETS, ticketOf, [onStuck], [{ ...onStuck, answer: answer(9) }])).toEqual([]);
  const plain = question({ id: "q2", ticketId: "t51" });
  expect(unblockedFeatures(TICKETS, ticketOf, [plain], [{ ...plain, answer: answer(9) }])).toEqual([]);
  expect(unblockedFeatures(TICKETS, ticketOf, [done], [open])).toEqual([]);
});

test("a ticket outside any feature is reported by its key, once", () => {
  const a = question({ id: "a", ticketId: "t9", blocking: true });
  const b = question({ id: "b", ticketId: "t51", blocking: true });
  expect(
    unblockedFeatures(
      TICKETS,
      ticketOf,
      [a, b],
      [
        { ...a, answer: answer(9) },
        { ...b, answer: answer(9) },
      ],
    ),
  ).toEqual(["F6", "EMIS-9"]);
});
