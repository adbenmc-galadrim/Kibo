import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { ticket } from "./question-fixtures.test-helper";
import { featureOf, impactOf } from "./ticket-feature";

const F6 = ticket("f6", "F6", { shortKey: "F6", sprintId: "s43", effectiveSprintId: "s43" });
const STEP = ticket("t51", "SILO-51", { parentId: "f6", effectiveSprintId: "s43" });
const LOOSE = ticket("t9", "SILO-9");
const ALL = new Map<string, TicketView>([F6, STEP, LOOSE].map((t) => [t.id, t]));
const ticketOf = (id: string) => ALL.get(id) ?? null;
const SPRINTS = [{ id: "s43", start: "2026-10-21" }];

test("featureOf climbs to the feature root of a step, or keeps a feature itself", () => {
  expect(featureOf(STEP, ticketOf)?.id).toBe("f6");
  expect(featureOf(F6, ticketOf)?.id).toBe("f6");
  expect(featureOf(LOOSE, ticketOf)).toBeNull();
});

test("impactOf names the feature by its title and the sprint by the Monday of its week", () => {
  expect(impactOf(STEP, ticketOf, SPRINTS)).toEqual({ feature: "Ticket F6", week: "2026-10-19" });
  expect(impactOf(LOOSE, ticketOf, SPRINTS)).toEqual({ feature: "Ticket SILO-9", week: null });
});
