import { expect, test } from "bun:test";
import type { Page } from "@kibo/schema";
import { type DropZone, pageDropPlan, parseZoneId, zoneId } from "./page-drop";

const page = (id: string, parentId: string | null): Page => ({ id, title: id, kind: "view", parentId });
const pages: Page[] = [
  page("dash", null),
  page("kanban", null),
  page("k1", "kanban"),
  page("k11", "k1"),
  page("notes", null),
];
const before = (pageId: string): DropZone => ({ kind: "before", pageId });
const after = (pageId: string): DropZone => ({ kind: "after", pageId });
const inside = (pageId: string): DropZone => ({ kind: "inside", pageId });
const root: DropZone = { kind: "root" };

test("zone ids round-trip and reject anything else", () => {
  expect(zoneId(root)).toBe("root");
  expect(zoneId(before("k1"))).toBe("k1:before");
  for (const zone of [root, before("k1"), inside("k1"), after("k1")]) {
    expect(parseZoneId(zoneId(zone))).toEqual(zone);
  }
  expect(parseZoneId("k1")).toBeNull();
  expect(parseZoneId("k1:nowhere")).toBeNull();
  expect(parseZoneId(":before")).toBeNull();
});

test("dropping next to a sibling gives the final index among the siblings without the moved page", () => {
  expect(pageDropPlan(pages, "dash", after("kanban"))).toEqual({ pageId: "dash", parentId: null, index: 1 });
  expect(pageDropPlan(pages, "notes", before("dash"))).toEqual({ pageId: "notes", parentId: null, index: 0 });
  expect(pageDropPlan(pages, "dash", after("notes"))).toEqual({ pageId: "dash", parentId: null, index: 2 });
});

test("dropping where the page already sits sends nothing", () => {
  expect(pageDropPlan(pages, "dash", before("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", after("dash"))).toBeNull();
  expect(pageDropPlan(pages, "notes", after("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "dash", root)).toBeNull();
  expect(pageDropPlan(pages, "k1", inside("kanban"))).toBeNull();
});

test("dropping between the children of another page reparents with the index", () => {
  expect(pageDropPlan(pages, "dash", before("k11"))).toEqual({ pageId: "dash", parentId: "k1", index: 0 });
  expect(pageDropPlan(pages, "notes", after("k1"))).toEqual({
    pageId: "notes",
    parentId: "kanban",
    index: 1,
  });
});

test("inside appends under the target, root brings back to the top level", () => {
  expect(pageDropPlan(pages, "notes", inside("k1"))).toEqual({ pageId: "notes", parentId: "k1" });
  expect(pageDropPlan(pages, "k11", root)).toEqual({ pageId: "k11", parentId: null });
});

test("a page never lands on itself nor inside its own subtree", () => {
  expect(pageDropPlan(pages, "kanban", before("k1"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", after("k11"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", inside("k11"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", inside("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "kanban", after("kanban"))).toBeNull();
  expect(pageDropPlan(pages, "ghost", after("dash"))).toBeNull();
  expect(pageDropPlan(pages, "dash", after("ghost"))).toBeNull();
});
