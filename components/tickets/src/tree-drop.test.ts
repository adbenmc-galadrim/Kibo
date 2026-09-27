import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { reparentOnDrop } from "./tree-drop";

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
