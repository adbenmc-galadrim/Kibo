import { expect, test } from "bun:test";
import { type ClientTicket, clientImpact, impactLine } from "./client-text";

const TRONCONS = { feature: "Tronçons et étapes", week: "2026-10-19" };

test("the impact line names the feature by its title and the week of its sprint", () => {
  expect(impactLine({ blocking: true }, TRONCONS)).toBe(
    "bloque « Tronçons et étapes », prévue semaine du 19 oct. · réponse souhaitée avant le 19 oct.",
  );
  expect(impactLine({ blocking: false }, { feature: "Rapports", week: "2026-10-26" })).toBe(
    "pour « Rapports », prévue semaine du 26 oct. · réponse souhaitée avant le 26 oct.",
  );
  expect(impactLine({ blocking: true }, { feature: "Tronçons et étapes", week: null })).toBe(
    "bloque « Tronçons et étapes », à planifier",
  );
});

const ticket = (id: string, patch: Partial<ClientTicket> = {}): ClientTicket => ({
  id,
  title: `Ticket ${id}`,
  parentId: null,
  shortKey: null,
  effectiveSprintId: null,
  ...patch,
});

test("the client impact of a step is the title of its feature and the Monday of its sprint", () => {
  const f6 = ticket("f6", { shortKey: "F6", title: "Import des factures" });
  const step = ticket("t51", { parentId: "f6", effectiveSprintId: "s43" });
  const all = new Map([f6, step].map((t) => [t.id, t]));
  const sprints = [{ id: "s43", start: "2026-10-21" }];
  expect(clientImpact(step, (id) => all.get(id) ?? null, sprints)).toEqual({
    feature: "Import des factures",
    week: "2026-10-19",
  });
  expect(clientImpact(ticket("t9"), () => null, sprints)).toEqual({ feature: "Ticket t9", week: null });
});
