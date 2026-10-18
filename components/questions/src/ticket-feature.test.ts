import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { ticket } from "./question-fixtures.test-helper";
import { featureOf, impactOf } from "./ticket-feature";

const F6 = ticket("f6", "F6", { shortKey: "F6", sprintId: "s43", effectiveSprintId: "s43" });
const STEP = ticket("t51", "EMIS-51", { parentId: "f6", effectiveSprintId: "s43" });
const LOOSE = ticket("t9", "EMIS-9");
const ALL = new Map<string, TicketView>([F6, STEP, LOOSE].map((t) => [t.id, t]));
const ticketOf = (id: string) => ALL.get(id) ?? null;
const SPRINTS = [{ id: "s43", code: "S43" }];

test("featureOf climbs to the feature root of a step, or keeps a feature itself", () => {
  expect(featureOf(STEP, ticketOf)?.id).toBe("f6");
  expect(featureOf(F6, ticketOf)?.id).toBe("f6");
  expect(featureOf(LOOSE, ticketOf)).toBeNull();
});

test("impactOf names the feature by F<n> and the sprint by its code", () => {
  expect(impactOf(STEP, ticketOf, SPRINTS)).toEqual({ feature: "F6", sprint: "S43" });
  expect(impactOf(LOOSE, ticketOf, SPRINTS)).toEqual({ feature: "EMIS-9", sprint: null });
});
