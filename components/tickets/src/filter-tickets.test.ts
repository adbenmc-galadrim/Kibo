import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import fc from "fast-check";
import {
  ALL_SPRINTS,
  chosenSprint,
  cleared,
  currentSprintOf,
  EMPTY_QUERY,
  filterTickets,
  inSprint,
  isActive,
  NO_SPRINT,
  narrowsOpen,
  projectLabels,
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

test("a query is active as soon as something narrows it; the sort never does", () => {
  expect(isActive(EMPTY_QUERY)).toBe(false);
  expect(isActive({ ...EMPTY_QUERY, sort: "key" })).toBe(false);
  expect(isActive({ ...EMPTY_QUERY, text: "  " })).toBe(false);
  for (const q of [
    { openOnly: true },
    { featureId: "f" },
    { text: "sync" },
    { statuses: new Set(["todo" as const]) },
    { assignee: "nobody" as const },
    { labels: new Set(["area:api"]) },
    { startable: true },
  ])
    expect(isActive({ ...EMPTY_QUERY, ...q })).toBe(true);
  expect(narrowsOpen({ ...EMPTY_QUERY, featureId: "f" })).toBe(false);
  expect(narrowsOpen({ ...EMPTY_QUERY, startable: true })).toBe(true);
  expect(cleared({ ...EMPTY_QUERY, sort: "key", text: "x", startable: true })).toEqual({
    ...EMPTY_QUERY,
    sort: "key",
  });
});

const demo: TicketView[] = createMockSdk(manifest, { seed: (run) => seedDemo(run) }).snapshot().tickets;
const keysOf = (ids: Set<string>) =>
  demo
    .filter((t) => ids.has(t.id))
    .map((t) => t.key)
    .sort();

test("text, statuses and assignee combine; accents and case are ignored", () => {
  expect(keysOf(filterTickets(demo, { ...EMPTY_QUERY, text: "schema" }, "adam"))).toEqual(["KIB-12"]);
  expect(keysOf(filterTickets(demo, { ...EMPTY_QUERY, text: "kib-28" }, "adam"))).toEqual(["KIB-28"]);
  expect(keysOf(filterTickets(demo, { ...EMPTY_QUERY, assignee: "nobody" }, "adam"))).toEqual([
    "KIB-3",
    "KIB-4",
    "KIB-6",
  ]);
  expect(
    filterTickets(demo, { ...EMPTY_QUERY, statuses: new Set(["blocked"]), assignee: "agents" }, "adam").size,
  ).toBe(0);
});

const bare = (id: string, labels: string[]): TicketView => {
  const base = demo[0];
  if (!base) throw new Error("demo seed is empty");
  return { ...base, id, key: id, keyLabel: id, parentId: null, labels };
};

test("label filter keeps tickets carrying every chosen label; the startable filter combines", () => {
  const a = { ...bare("a", ["area:api", "phase:p1"]), startable: true };
  const b = { ...bare("b", ["area:web"]), startable: true };
  const c = { ...bare("c", []), startable: false };
  const q = { ...EMPTY_QUERY, labels: new Set(["area:api"]) };
  expect([...filterTickets([a, b, c], q, "me")]).toEqual(["a"]);
  expect([...filterTickets([a, b, c], { ...q, labels: new Set(["area:api", "phase:p1"]) }, "me")]).toEqual([
    "a",
  ]);
  expect(filterTickets([a, b, c], { ...q, labels: new Set(["gone"]) }, "me").size).toBe(0);
  expect([...filterTickets([a, b, c], { ...EMPTY_QUERY, startable: true }, "me")]).toEqual(["a", "b"]);
  expect(projectLabels([a, b, c])).toEqual(["area:api", "area:web", "phase:p1"]);
});

const label = fc.stringMatching(/^[a-z]{1,3}(:[a-z]{1,3})?$/);

test("a ticket without labels passes only the empty label filter", () => {
  const c = bare("c", []);
  fc.assert(
    fc.property(fc.array(label, { maxLength: 5 }), (chosen) => {
      const hit = filterTickets([c], { ...EMPTY_QUERY, labels: new Set(chosen) }, "me").has("c");
      return hit === (chosen.length === 0);
    }),
  );
});

test("choosing one more label never shows more tickets", () => {
  fc.assert(
    fc.property(
      fc.array(fc.array(label, { maxLength: 4 }), { maxLength: 6 }),
      fc.array(label, { maxLength: 3 }),
      label,
      (labelSets, chosen, extra) => {
        const all = labelSets.map((ls, i) => bare(`t${i}`, ls));
        const wide = filterTickets(all, { ...EMPTY_QUERY, labels: new Set(chosen) }, "me");
        const narrow = filterTickets(all, { ...EMPTY_QUERY, labels: new Set([...chosen, extra]) }, "me");
        return [...narrow].every((id) => wide.has(id));
      },
    ),
  );
});
