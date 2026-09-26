import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { buildTree, mineOnly } from "./build-tree";

const t = (id: string, parentId: string | null, assignee: TicketView["assignee"] = null): TicketView => ({
  id,
  key: `KIB-${id}`,
  title: id,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee,
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

test("mineOnly keeps the viewer's tickets and lifts those whose parent is hidden", () => {
  const human = (ref: string) => ({ kind: "human" as const, ref });
  const tickets = [
    t("a", null, human("bob")),
    t("b", "a", human("adam")),
    t("c", "b", human("adam")),
    t("d", null, human("adam")),
    t("e", null, { kind: "agent", ref: "adam" }),
  ];
  expect(mineOnly(tickets, "adam").map((x) => [x.id, x.parentId])).toEqual([
    ["b", null],
    ["c", "b"],
    ["d", null],
  ]);
});
