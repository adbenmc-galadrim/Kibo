import { expect, test } from "bun:test";
import { DEFAULT_QUERY, filterComponents, toggleSort } from "./filter-components";
import type { ComponentRow } from "./rows";

const row = (over: Partial<ComponentRow>): ComponentRow => ({
  key: "k",
  id: "kanban",
  title: "Kanban",
  version: "1.0.0",
  builtin: true,
  trust: "builtin",
  tampered: false,
  origin: "kibo",
  pages: 2,
  projects: 1,
  used: true,
  usages: [],
  summary: null,
  revoked: null,
  market: null,
  ...over,
});
const rows = [
  row({}),
  row({
    key: "m",
    id: "meteo",
    title: "Météo",
    builtin: false,
    trust: "sandboxed",
    origin: "marketplace",
    pages: 0,
    projects: 0,
    used: false,
  }),
  row({
    key: "a",
    id: "acme.bug",
    title: "Bugs Acme",
    builtin: false,
    trust: "pending",
    origin: "ai",
    version: "2.1.0",
    pages: 5,
    projects: 3,
  }),
];

test("text search ignores case and accents, on title and id", () => {
  expect(filterComponents(rows, { ...DEFAULT_QUERY, text: "meteo" }).map((r) => r.id)).toEqual(["meteo"]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, text: "ACME.B" }).map((r) => r.id)).toEqual(["acme.bug"]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, text: "  " }).map((r) => r.id)).toHaveLength(3);
});

test("trust and origin filters combine", () => {
  expect(filterComponents(rows, { ...DEFAULT_QUERY, trust: "pending" }).map((r) => r.id)).toEqual([
    "acme.bug",
  ]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, trust: "trusted" }).map((r) => r.id)).toEqual(["kanban"]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, origin: "kibo", trust: "sandboxed" })).toEqual([]);
  expect(filterComponents(rows, { ...DEFAULT_QUERY, origin: "marketplace" }).map((r) => r.id)).toEqual([
    "meteo",
  ]);
});

test("default sort is by title in French order", () => {
  expect(filterComponents(rows, DEFAULT_QUERY).map((r) => r.id)).toEqual(["acme.bug", "kanban", "meteo"]);
});

test("sorting by usage puts the most used first when descending, and toggleSort flips", () => {
  const q = toggleSort(DEFAULT_QUERY, "usage");
  expect([q.sort, q.descending]).toEqual(["usage", true]);
  expect(filterComponents(rows, q).map((r) => r.id)).toEqual(["acme.bug", "kanban", "meteo"]);
  expect(toggleSort(q, "usage").descending).toBe(false);
  expect(toggleSort(q, "title")).toEqual({ ...q, sort: "title", descending: false });
  expect(filterComponents(rows, { ...DEFAULT_QUERY, sort: "version", descending: true })[0]?.version).toBe(
    "2.1.0",
  );
});

test("versions compare as semver, not as text", () => {
  const many = [row({ key: "x", version: "1.10.0" }), row({ key: "y", version: "1.9.0" })];
  expect(filterComponents(many, { ...DEFAULT_QUERY, sort: "version" }).map((r) => r.version)).toEqual([
    "1.9.0",
    "1.10.0",
  ]);
});
