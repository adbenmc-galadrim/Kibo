import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { EMPTY_QUERY, filterTickets, isActive } from "./filter-tickets";
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
