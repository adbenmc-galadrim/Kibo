import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import { buildTree, mineOnly, withAncestors } from "./build-tree";

const t = (id: string, parentId: string | null, assignee: TicketView["assignee"] = null): TicketView => ({
  id,
  key: `KIB-${id}`,
  pendingSeq: null,
  keyLabel: `KIB-${id}`,
  title: id,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee,
  parentId,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
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

test("withAncestors keeps the selected tickets and every ancestor, nothing else", () => {
  const tickets = [t("a", null), t("b", "a"), t("c", "b"), t("d", null), t("e", "a")];
  expect([...withAncestors(tickets, ["c"])].sort()).toEqual(["a", "b", "c"]);
  expect([...withAncestors(tickets, ["d", "missing"])].sort()).toEqual(["d", "missing"]);
});
