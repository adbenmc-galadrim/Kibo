import { expect, test } from "bun:test";
import type { StatusId } from "./status";
import { deriveGroups, groupStatus, isGroup } from "./ticket-group";

test("a ticket is a group as soon as it has a sub-ticket", () => {
  expect(isGroup({ progress: { done: 0, total: 0 } })).toBe(false);
  expect(isGroup({ progress: { done: 0, total: 1 } })).toBe(true);
  expect(isGroup({ progress: { done: 3, total: 3 } })).toBe(true);
});

test("the status of a group follows its sub-tickets", () => {
  const cases: [StatusId[], StatusId][] = [
    [["done", "done"], "done"],
    [["todo", "backlog"], "todo"],
    [["todo", "in_progress"], "in_progress"],
    [["todo", "in_review"], "in_progress"],
    [["todo", "blocked"], "in_progress"],
    [["todo", "done"], "in_progress"],
  ];
  for (const [children, expected] of cases) expect(groupStatus(children)).toBe(expected);
});

const t = (id: string, parentId: string | null, statusId: StatusId) => ({ id, parentId, statusId });

test("groups are derived bottom-up, a nested group counting as one sub-ticket", () => {
  const groups = deriveGroups([
    t("c4", null, "todo"),
    t("a", "c4", "done"),
    t("b", "c4", "todo"),
    t("n", "c4", "backlog"),
    t("n1", "n", "done"),
    t("n2", "n", "done"),
    t("solo", null, "in_review"),
  ]);
  expect([...groups.keys()].sort()).toEqual(["c4", "n"]);
  expect(groups.get("n")).toEqual({ statusId: "done", progress: { done: 2, total: 2 } });
  expect(groups.get("c4")).toEqual({ statusId: "in_progress", progress: { done: 2, total: 3 } });
});

test("a group whose sub-tickets are all waiting stays to do, whatever was stored", () => {
  const groups = deriveGroups([t("g", null, "done"), t("a", "g", "todo")]);
  expect(groups.get("g")).toEqual({ statusId: "todo", progress: { done: 0, total: 1 } });
});

test("an optional step left to do does not keep its group open, but still counts in the progress", () => {
  expect(groupStatus(["done", "todo"], ["done"])).toBe("done");
  expect(groupStatus(["todo", "in_progress"], ["todo"])).toBe("in_progress");
  const groups = deriveGroups([
    t("f3", null, "todo"),
    t("a", "f3", "done"),
    { ...t("demo", "f3", "todo"), optional: true },
  ]);
  expect(groups.get("f3")).toEqual({ statusId: "done", progress: { done: 1, total: 2 } });
});
