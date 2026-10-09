import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import fc from "fast-check";
import { EMPTY_QUERY, filterTickets, filterTree, isActive, projectLabels } from "./filter-tickets";
import { manifest } from "./index";

const tickets: TicketView[] = createMockSdk(manifest, { seed: (run) => seedDemo(run) }).snapshot().tickets;
const keysOf = (ids: Set<string>) =>
  tickets
    .filter((t) => ids.has(t.id))
    .map((t) => t.key)
    .sort();

test("a matching child keeps its ancestors visible; statuses and assignee combine; accents are ignored", () => {
  expect(keysOf(filterTickets(tickets, { ...EMPTY_QUERY, text: "schema" }, "adam"))).toEqual([
    "KIB-12",
    "KIB-3",
  ]);
  expect(keysOf(filterTickets(tickets, { ...EMPTY_QUERY, text: "kib-28" }, "adam"))).toEqual([
    "KIB-12",
    "KIB-27",
    "KIB-28",
    "KIB-3",
  ]);
  const mine = filterTickets(tickets, { ...EMPTY_QUERY, assignee: "me" }, "adam");
  expect(keysOf(mine)).toEqual(
    ["KIB-11", "KIB-13", "KIB-15", "KIB-21", "KIB-22", "KIB-3", "KIB-5", "KIB-6", "KIB-7", "KIB-9"].sort(),
  );
  expect(
    filterTickets(tickets, { ...EMPTY_QUERY, statuses: new Set(["blocked"]), assignee: "agents" }, "adam")
      .size,
  ).toBe(0);
  expect(
    keysOf(
      filterTickets(tickets, { ...EMPTY_QUERY, statuses: new Set(["done"]), assignee: "agents" }, "adam"),
    ),
  ).toEqual(["KIB-12", "KIB-24", "KIB-25", "KIB-26", "KIB-3"]);
  expect(keysOf(filterTickets(tickets, { ...EMPTY_QUERY, assignee: "nobody" }, "adam"))).toEqual([
    "KIB-3",
    "KIB-4",
    "KIB-6",
  ]);
});

test("a query is active as soon as a text, a status or an assignee narrows it", () => {
  expect(isActive(EMPTY_QUERY)).toBe(false);
  expect(isActive({ ...EMPTY_QUERY, text: "  " })).toBe(false);
  expect(isActive({ ...EMPTY_QUERY, text: "sync" })).toBe(true);
  expect(isActive({ ...EMPTY_QUERY, statuses: new Set(["todo"]) })).toBe(true);
  expect(isActive({ ...EMPTY_QUERY, assignee: "nobody" })).toBe(true);
});

test("ancestors kept only for context are told apart from the matches", () => {
  const { visible, context } = filterTree(tickets, { ...EMPTY_QUERY, text: "schema" }, "adam");
  expect(keysOf(visible)).toEqual(["KIB-12", "KIB-3"]);
  expect(keysOf(context)).toEqual(["KIB-3"]);
});

const bare = (id: string, labels: string[]): TicketView => {
  const base = tickets[0];
  if (!base) throw new Error("demo seed is empty");
  return { ...base, id, key: id, parentId: null, labels };
};

test("label filter keeps tickets carrying every chosen label", () => {
  const a = bare("a", ["area:api", "phase:p1"]);
  const b = bare("b", ["area:web"]);
  const c = bare("c", []);
  const q = { ...EMPTY_QUERY, labels: new Set(["area:api"]) };
  expect([...filterTickets([a, b, c], q, "me")]).toEqual(["a"]);
  expect([...filterTickets([a, b, c], { ...q, labels: new Set(["area:api", "phase:p1"]) }, "me")]).toEqual([
    "a",
  ]);
  expect(filterTickets([a, b, c], { ...q, labels: new Set(["gone"]) }, "me").size).toBe(0);
  expect(isActive(q)).toBe(true);
  expect(isActive(EMPTY_QUERY)).toBe(false);
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
