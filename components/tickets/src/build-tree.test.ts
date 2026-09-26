import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { buildTree } from "./build-tree";

const t = (id: string, parentId: string | null): TicketView => ({
  id,
  key: `KIB-${id}`,
  title: id,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
});

test("nests children under their parent, keeping order and depth", () => {
  const tree = buildTree([t("1", null), t("2", "1"), t("3", "2"), t("4", null)]);
  expect(tree.map((n) => n.ticket.id)).toEqual(["1", "4"]);
  expect(tree[0]?.children[0]?.children[0]).toMatchObject({ depth: 2, ticket: { id: "3" } });
});
