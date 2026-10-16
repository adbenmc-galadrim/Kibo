import { expect, test } from "bun:test";
import { createMockSdk } from "@kibo/sdk/mock";
import {
  ALL_SPRINTS,
  chosenSprint,
  currentSprintOf,
  EMPTY_QUERY,
  inSprint,
  isActive,
  NO_SPRINT,
  sortTickets,
} from "./filter-tickets";
import { manifest } from "./index";
import { TODAY, trackingSeed } from "./test-seed";

const NOW = Date.parse(`${TODAY}T14:52:00`);
const snapshot = createMockSdk(manifest, { seed: trackingSeed(NOW), today: TODAY }).snapshot();
const sprint = (name: string) => snapshot.sprints.find((s) => s.name === name)?.id ?? "";
const keys = (ts: { keyLabel: string }[]) => ts.map((t) => t.keyLabel);

test("the sprint shown defaults to the current one and keeps a saved choice that still exists", () => {
  expect(currentSprintOf(snapshot.sprints)?.name).toBe("S42");
  expect(chosenSprint(undefined, snapshot.sprints)).toBe(sprint("S42"));
  expect(chosenSprint(null, snapshot.sprints)).toBe(sprint("S42"));
  expect(chosenSprint(sprint("S43"), snapshot.sprints)).toBe(sprint("S43"));
  expect(chosenSprint("deleted", snapshot.sprints)).toBe(sprint("S42"));
  expect(chosenSprint(ALL_SPRINTS, snapshot.sprints)).toBe(ALL_SPRINTS);
  expect(chosenSprint(NO_SPRINT, snapshot.sprints)).toBe(NO_SPRINT);
  expect(chosenSprint(undefined, [])).toBe(ALL_SPRINTS);
});

test("a ticket belongs to the sprint of its feature; À planifier keeps those without one", () => {
  const byTitle = (title: string) => snapshot.tickets.find((t) => t.title === title);
  const step = byTitle("Écran d'envoi hors ligne");
  const later = byTitle("Gabarit PDF");
  if (!step || !later) throw new Error("seed");
  expect(inSprint(step, sprint("S42"))).toBe(true);
  expect(inSprint(step, sprint("S43"))).toBe(false);
  expect(inSprint(step, ALL_SPRINTS)).toBe(true);
  expect(inSprint(step, NO_SPRINT)).toBe(false);
  expect(inSprint(later, NO_SPRINT)).toBe(true);
});

test("recent activity first, tickets without activity last in key order; key order is numeric", () => {
  const leaves = snapshot.tickets.filter((t) =>
    ["KIB-9", "KIB-10", "KIB-14", "KIB-15", "KIB-2"].includes(t.keyLabel),
  );
  expect(keys(sortTickets(leaves, "recent"))).toEqual(["KIB-14", "KIB-9", "KIB-2", "KIB-10", "KIB-15"]);
  expect(keys(sortTickets(leaves, "key"))).toEqual(["KIB-2", "KIB-9", "KIB-10", "KIB-14", "KIB-15"]);
});

test("a query is active when it hides done tickets or keeps one feature", () => {
  expect(isActive(EMPTY_QUERY)).toBe(false);
  expect(isActive({ ...EMPTY_QUERY, openOnly: true })).toBe(true);
  expect(isActive({ ...EMPTY_QUERY, featureId: "f" })).toBe(true);
  expect(isActive({ ...EMPTY_QUERY, sort: "key" })).toBe(false);
});
