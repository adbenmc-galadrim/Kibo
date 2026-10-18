import { expect, test } from "bun:test";
import type { ProjectEvent } from "@kibo/schema";
import { build } from "./model-test-kit";
import { overviewModel } from "./overview-model";

const MONDAY = "2026-10-19";
const WEDNESDAY = "2026-10-14";

const slip = (id: number, ticketId: string, from: string | null, day: string): ProjectEvent => ({
  id,
  projectId: "mock",
  at: new Date(`${day}T10:00:00`).getTime(),
  kind: "sprint_set",
  ticketId,
  featureId: ticketId,
  source: "user",
  data: from === null ? { to: "S42" } : { from, to: "S43" },
});

function slippedF5(today: string, movedOn = WEDNESDAY) {
  const { input, byTitle } = build(today);
  const f5 = byTitle("Envoyer les photos d'un constat");
  const s43 = input.sprints.find((s) => s.code === "S43");
  if (s43 === undefined) throw new Error("S43");
  const tickets = input.tickets.map((t) => (t.id === f5.id ? { ...t, sprintId: s43.id } : t));
  const events = [...input.events, slip(100, f5.id, null, "2026-10-05"), slip(101, f5.id, "S42", movedOn)];
  return overviewModel({ ...input, tickets, events });
}

test("a feature moved from an earlier sprint says where it slipped from", () => {
  const model = slippedF5(MONDAY);
  const row = model.sprint?.rows.find((r) => r.shortKey === "F5");
  expect(row?.slipped).toBe("S42");
  expect(model.sprint?.rows.find((r) => r.shortKey === "F6")?.slipped).toBeNull();
});

test("a feature moved before its sprint started has not slipped", () => {
  const model = slippedF5(MONDAY, "2026-10-09");
  expect(model.sprint?.rows.find((r) => r.shortKey === "F5")?.slipped).toBeNull();
  expect(model.deadlines.rows.find((r) => r.shortKey === "F5")?.note).toBeUndefined();
});

test("a feature is at risk when its mandatory steps outnumber the working days left", () => {
  const model = build(WEDNESDAY).model;
  expect(model.sprint?.rows.map((r) => [r.shortKey, r.risk])).toEqual([
    ["F3", false],
    ["F4", false],
    ["F5", true],
  ]);
  expect(model.indicators.atRisk).toBe(1);
});

test("no feature is at risk once its sprint is over", () => {
  const model = build("2026-10-18").model;
  expect(model.sprint?.rows.some((r) => r.risk)).toBe(false);
  expect(model.indicators.atRisk).toBe(0);
});

test("the next feature to finish is a late one first, the most advanced", () => {
  const next = build(MONDAY).model.next;
  expect(next?.shortKey).toBe("F4");
  expect(next?.late).toBe(true);
  expect(build().model.next?.late).toBe(false);
});

test("the deadlines tint the features at risk and say where a feature slipped from", () => {
  const rows = build().model.deadlines.rows;
  expect(rows.map((r) => [r.shortKey, r.tone ?? null])).toEqual([
    ["F4", "risk"],
    ["F5", "risk"],
    ["F6", null],
    ["F8", null],
    ["F7", null],
  ]);
  const slipped = slippedF5(MONDAY).deadlines.rows.find((r) => r.shortKey === "F5");
  expect(slipped?.note).toBe("glissée de S42");
  expect(build("2026-10-18").model.deadlines.rows.find((r) => r.shortKey === "F5")?.tone).toBe("late");
});
