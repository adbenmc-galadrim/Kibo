import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { type DropZone, dropPlan, parseZoneId, reparentOnDrop, zoneId } from "./tree-drop";

const t = (id: string, parentId: string | null) => ({ id, parentId }) as TicketView;
const tickets = [t("a", null), t("b", "a"), t("c", "b"), t("d", null)];

test("dropping on another ticket reparents under it", () => {
  expect(reparentOnDrop(tickets, "d", "b")).toEqual({ ticketId: "d", parentId: "b" });
});

test("dropping on itself, on its parent or on a descendant does nothing", () => {
  expect(reparentOnDrop(tickets, "b", "b")).toBeNull();
  expect(reparentOnDrop(tickets, "b", "a")).toBeNull();
  expect(reparentOnDrop(tickets, "a", "c")).toBeNull();
  expect(reparentOnDrop(tickets, "a", "zz")).toBeNull();
});

const tree = [t("a", null), t("b", "a"), t("c", "b"), t("d", null), t("e", null)];
const before = (ticketId: string): DropZone => ({ kind: "before", ticketId });
const after = (ticketId: string): DropZone => ({ kind: "after", ticketId });
const inside = (ticketId: string): DropZone => ({ kind: "inside", ticketId });

test("zone ids round-trip on Loro ids and reject anything else", () => {
  for (const zone of [before("27@1"), inside("27@1"), after("27@1")]) {
    expect(parseZoneId(zoneId(zone))).toEqual(zone);
  }
  expect(parseZoneId("27@1")).toBeNull();
  expect(parseZoneId("27@1:top")).toBeNull();
});

test("dropping next to a sibling gives the final index among the siblings without the moved ticket", () => {
  expect(dropPlan(tree, "a", after("d"))).toEqual({ ticketId: "a", parentId: null, index: 1 });
  expect(dropPlan(tree, "e", before("a"))).toEqual({ ticketId: "e", parentId: null, index: 0 });
  expect(dropPlan(tree, "a", after("e"))).toEqual({ ticketId: "a", parentId: null, index: 2 });
});

test("dropping where the ticket already sits sends nothing", () => {
  expect(dropPlan(tree, "a", before("d"))).toBeNull();
  expect(dropPlan(tree, "d", after("a"))).toBeNull();
  expect(dropPlan(tree, "b", inside("a"))).toBeNull();
});

test("dropping between the children of another ticket reparents with the index", () => {
  expect(dropPlan(tree, "d", before("c"))).toEqual({ ticketId: "d", parentId: "b", index: 0 });
  expect(dropPlan(tree, "e", after("b"))).toEqual({ ticketId: "e", parentId: "a", index: 1 });
});

test("inside delegates to reparentOnDrop", () => {
  expect(dropPlan(tree, "d", inside("b"))).toEqual({ ticketId: "d", parentId: "b" });
  expect(dropPlan(tree, "a", inside("c"))).toBeNull();
});

test("a ticket never lands on itself nor inside its own subtree", () => {
  expect(dropPlan(tree, "a", before("b"))).toBeNull();
  expect(dropPlan(tree, "a", after("c"))).toBeNull();
  expect(dropPlan(tree, "a", after("a"))).toBeNull();
  expect(dropPlan(tree, "zz", after("a"))).toBeNull();
  expect(dropPlan(tree, "a", after("zz"))).toBeNull();
});
