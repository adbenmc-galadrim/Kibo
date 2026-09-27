import { describe, expect, test } from "bun:test";
import { EMPTY_TABS, type TabsState, type TabTarget } from "@kibo/schema";
import { activeTarget, tabsReducer } from "./tabs-model";
import { hashToTarget, targetToHash } from "./target-hash";
import { shortcutFor } from "./use-tab-shortcuts";

const page = (pageId: string): TabTarget => ({ kind: "page", projectId: "p1", pageId });
const open = (s: TabsState, target: TabTarget, id: string, newTab = false) =>
  tabsReducer(s, { type: "open", target, newTab, id });

describe("hash codec", () => {
  const targets: TabTarget[] = [
    { kind: "project", projectId: "p1" },
    page("1@2"),
    { kind: "ticket", projectId: "p1", ticketId: "4@2" },
    { kind: "changes", projectId: "p1", worktree: null },
    { kind: "changes", projectId: "p1", worktree: "/wt/kib 12" },
    { kind: "file", projectId: "p1", worktree: "/wt", path: "packages/core/ticket.ts", line: 42 },
    { kind: "screen", screen: "agents" },
    { kind: "screen", screen: "queue" },
    { kind: "screen", screen: "general" },
    { kind: "screen", screen: "domains" },
    { kind: "screen", screen: "components" },
    { kind: "screen", screen: "integrations" },
    { kind: "screen", screen: "appearance" },
    { kind: "screen", screen: "security" },
    { kind: "screen", screen: "sources" },
  ];
  test("round-trips every target kind", () => {
    for (const t of targets) expect(hashToTarget(targetToHash(t))).toEqual(t);
    expect(targetToHash(null)).toBe("#/");
    expect(hashToTarget("#/")).toBeNull();
  });
  test("keeps MVP URLs and rejects invalid ones", () => {
    expect(hashToTarget("#/p/p1/1%401")).toEqual(page("1@1"));
    expect(hashToTarget("#/p/p1/")).toEqual({ kind: "project", projectId: "p1" });
    expect(hashToTarget("#/p/p1/file?path=..%2Fetc")).toBeNull();
    expect(hashToTarget("#/p/%E0%A4%A/")).toBeNull();
  });
  test("screens keep their addresses", () => {
    expect(targetToHash({ kind: "screen", screen: "queue" })).toBe("#/agents/queue");
    expect(hashToTarget("#/settings/domains/")).toEqual({ kind: "screen", screen: "domains" });
    expect(hashToTarget("#/settings/general")).toEqual({ kind: "screen", screen: "general" });
    expect(hashToTarget("#/settings/integrations")).toEqual({ kind: "screen", screen: "integrations" });
    expect(hashToTarget("#/settings/sync")).toEqual({ kind: "screen", screen: "sync" });
    expect(targetToHash({ kind: "screen", screen: "sync" })).toBe("#/settings/sync");
    expect(hashToTarget("#/settings/appearance")).toEqual({ kind: "screen", screen: "appearance" });
    expect(targetToHash({ kind: "screen", screen: "security" })).toBe("#/settings/security");
    expect(hashToTarget("#/settings/components")).toEqual({ kind: "screen", screen: "sources" });
    expect(hashToTarget("#/agents")).toEqual({ kind: "screen", screen: "agents" });
    expect(targetToHash({ kind: "screen", screen: "components" })).toBe("#/components");
    expect(hashToTarget("#/mine")).toEqual({ kind: "screen", screen: "mine" });
    expect(hashToTarget("#/elsewhere")).toBeNull();
  });
});

describe("tabsReducer", () => {
  test("a plain open replaces the active tab, a new-tab open appends, a known target is focused", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1"]);
    s = open(s, page("b"), "t2");
    expect(s.tabs).toEqual([{ id: "t1", target: page("b"), pinned: false }]);
    s = open(s, page("c"), "t3", true);
    expect(s.activeId).toBe("t3");
    s = open(s, page("b"), "t4", true);
    expect(s.tabs).toHaveLength(2);
    expect(s.activeId).toBe("t1");
    expect(s.recents.map((r) => (r.kind === "page" ? r.pageId : ""))).toEqual(["b", "c", "a"]);
  });

  test("home and pinned tabs are never replaced", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    s = tabsReducer(s, { type: "pin", id: "t1", pinned: true });
    s = open(s, page("b"), "t2");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1", "t2"]);
    s = tabsReducer(s, { type: "activate", id: null });
    s = open(s, page("c"), "t3");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  test("closing focuses the right neighbour, then the left, then home; pinned tabs resist", () => {
    let s = open(open(open(EMPTY_TABS, page("a"), "t1"), page("b"), "t2", true), page("c"), "t3", true);
    s = tabsReducer(s, { type: "activate", id: "t2" });
    s = tabsReducer(s, { type: "close", id: "t2" });
    expect(s.activeId).toBe("t3");
    s = tabsReducer(s, { type: "close", id: "t3" });
    expect(s.activeId).toBe("t1");
    s = tabsReducer(s, { type: "pin", id: "t1", pinned: true });
    expect(tabsReducer(s, { type: "close", id: "t1" })).toEqual(s);
    s = tabsReducer(s, { type: "pin", id: "t1", pinned: false });
    s = tabsReducer(s, { type: "close", id: "t1" });
    expect(s.activeId).toBeNull();
  });

  test("close others and close to the right keep pinned tabs", () => {
    let s = EMPTY_TABS;
    for (const id of ["t1", "t2", "t3", "t4"]) s = open(s, page(id), id, true);
    s = tabsReducer(s, { type: "pin", id: "t4", pinned: true });
    expect(s.tabs.map((t) => t.id)).toEqual(["t4", "t1", "t2", "t3"]);
    expect(tabsReducer(s, { type: "closeOthers", id: "t2" }).tabs.map((t) => t.id)).toEqual(["t4", "t2"]);
    expect(tabsReducer(s, { type: "closeRight", id: "t1" }).tabs.map((t) => t.id)).toEqual(["t4", "t1"]);
    expect(tabsReducer(s, { type: "closeOthers", id: "unknown" })).toEqual(s);
  });

  test("duplicate, move within the group and index shortcuts", () => {
    let s = EMPTY_TABS;
    for (const id of ["t1", "t2", "t3"]) s = open(s, page(id), id, true);
    s = tabsReducer(s, { type: "duplicate", id: "t1", newId: "t1b" });
    expect(s.tabs.map((t) => t.id)).toEqual(["t1", "t1b", "t2", "t3"]);
    expect(s.activeId).toBe("t1b");
    s = tabsReducer(s, { type: "pin", id: "t3", pinned: true });
    s = tabsReducer(s, { type: "move", id: "t2", toIndex: 0 });
    expect(s.tabs.map((t) => t.id)).toEqual(["t3", "t2", "t1", "t1b"]);
    expect(activeTarget(tabsReducer(s, { type: "activateIndex", index: 0 }))).toBeNull();
    expect(tabsReducer(s, { type: "activateIndex", index: 1 }).activeId).toBe("t3");
    expect(tabsReducer(s, { type: "activateIndex", index: 8 }).activeId).toBe("t1b");
    expect(tabsReducer(s, { type: "activateIndex", index: 7 })).toEqual(s);
  });

  test("the tab count stays bounded", () => {
    let s = EMPTY_TABS;
    for (let i = 0; i < 55; i++) s = open(s, page(`p${i}`), `t${i}`, true);
    expect(s.tabs).toHaveLength(50);
    expect(s.activeId).toBe("t54");
  });
});

test("shortcuts use ⌘ on macOS and Ctrl elsewhere", () => {
  const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });
  expect(shortcutFor(key("t", { metaKey: true }), true)).toEqual({ kind: "newTab" });
  expect(shortcutFor(key("t", { ctrlKey: true }), true)).toBeNull();
  expect(shortcutFor(key("w", { ctrlKey: true }), false)).toEqual({ kind: "close" });
  expect(shortcutFor(key("k", { metaKey: true }), true)).toEqual({ kind: "palette" });
  expect(shortcutFor(key("3", { metaKey: true }), true)).toEqual({ kind: "activate", index: 2 });
  expect(shortcutFor(key("P", { metaKey: true, shiftKey: true }), true)).toEqual({ kind: "togglePin" });
  expect(shortcutFor(key("t"), true)).toBeNull();
});
