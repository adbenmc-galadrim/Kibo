import { describe, expect, test } from "bun:test";
import { EMPTY_TABS, salvageTabsState, singlePreview, TabsState, type TabTarget } from "@kibo/schema";
import { activeTarget, closedTargets, tabsReducer } from "./tabs-model";
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
    { kind: "screen", screen: "shortcuts" },
    { kind: "screen", screen: "workspace" },
    { kind: "screen", screen: "inbox" },
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
    expect(targetToHash({ kind: "screen", screen: "creations" })).toBe("#/creations");
    expect(hashToTarget("#/creations")).toEqual({ kind: "screen", screen: "creations" });
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
    expect(targetToHash({ kind: "screen", screen: "inbox" })).toBe("#/inbox");
    expect(hashToTarget("#/inbox")).toEqual({ kind: "screen", screen: "inbox" });
    expect(hashToTarget("#/elsewhere")).toBeNull();
  });
  test("the shortcuts screen has its settings hash", () => {
    expect(targetToHash({ kind: "screen", screen: "shortcuts" })).toBe("#/settings/shortcuts");
    expect(hashToTarget("#/settings/shortcuts")).toEqual({ kind: "screen", screen: "shortcuts" });
    expect(targetToHash({ kind: "screen", screen: "workspace" })).toBe("#/settings/workspace");
  });
});

describe("tabsReducer", () => {
  test("closeProject closes every tab of the project, pinned included, and purges its recents", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    s = open(s, { kind: "ticket", projectId: "p1", ticketId: "x" }, "t2", true);
    s = tabsReducer(s, { type: "pin", id: "t2", pinned: true });
    s = open(s, { kind: "project", projectId: "p2" }, "t3", true);
    s = open(s, { kind: "screen", screen: "agents" }, "t4", true);
    s = tabsReducer(s, { type: "activate", id: "t2" });
    const out = tabsReducer(s, { type: "closeProject", projectId: "p1" });
    expect(out.tabs.map((t) => t.id)).toEqual(["t3", "t4"]);
    expect(out.activeId).toBe("t3");
    expect(out.recents.every((r) => r.kind === "screen" || r.projectId !== "p1")).toBe(true);
    expect(out.recents.some((r) => r.kind === "project" && r.projectId === "p2")).toBe(true);
    expect(tabsReducer(out, { type: "closeProject", projectId: "nope" })).toBe(out);
  });

  test("a plain open replaces the preview tab, a new-tab open appends, a known target is focused", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    expect(s.tabs.map((t) => t.id)).toEqual(["t1"]);
    s = open(s, page("b"), "t2");
    expect(s.tabs).toEqual([{ id: "t1", target: page("b"), pinned: false, preview: true }]);
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
    expect(s.tabs.map((t) => [t.id, t.target])).toEqual([
      ["t1", page("a")],
      ["t2", page("c")],
    ]);
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

describe("preview tabs", () => {
  test("a stored state without preview is read as permanent tabs, two previews are reduced to the last", () => {
    const raw = { tabs: [{ id: "t1", target: page("a"), pinned: false }], activeId: "t1", recents: [] };
    expect(TabsState.parse(raw).tabs[0]?.preview).toBe(false);
    expect(salvageTabsState(raw)?.tabs[0]?.preview).toBe(false);
    const two = [
      { id: "t1", target: page("a"), pinned: false, preview: true },
      { id: "t2", target: page("b"), pinned: false, preview: true },
    ];
    expect(singlePreview(two).map((t) => t.preview)).toEqual([false, true]);
    expect(salvageTabsState({ tabs: two, activeId: "t1", recents: [] })?.tabs.map((t) => t.preview)).toEqual([
      false,
      true,
    ]);
  });

  test("a plain open uses the single preview tab, a kept open or a new tab is permanent", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    expect(s.tabs).toEqual([{ id: "t1", target: page("a"), pinned: false, preview: true }]);
    s = open(s, page("b"), "t2");
    expect(s.tabs.map((t) => [t.id, t.preview])).toEqual([["t1", true]]);
    expect(activeTarget(s)).toEqual(page("b"));
    s = tabsReducer(s, { type: "keep", id: "t1" });
    expect(s.tabs[0]?.preview).toBe(false);
    s = open(s, page("c"), "t3");
    expect(s.tabs.map((t) => [t.target, t.preview])).toEqual([
      [page("b"), false],
      [page("c"), true],
    ]);
    s = open(s, page("d"), "t4", true);
    expect(s.tabs.map((t) => t.preview)).toEqual([false, true, false]);
    expect(s.activeId).toBe("t4");
    s = tabsReducer(s, { type: "open", target: page("e"), newTab: false, id: "t5", keep: true });
    expect(s.tabs.map((t) => [t.target, t.preview])).toEqual([
      [page("b"), false],
      [page("e"), false],
      [page("d"), false],
    ]);
  });

  test("an open target is activated and kept if asked; pin, duplicate and move make permanent", () => {
    let s = open(EMPTY_TABS, page("a"), "t1");
    s = open(s, page("a"), "t2");
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0]?.preview).toBe(true);
    s = tabsReducer(s, { type: "open", target: page("a"), newTab: false, id: "t3", keep: true });
    expect(s.tabs).toEqual([{ id: "t1", target: page("a"), pinned: false, preview: false }]);
    s = open(s, page("b"), "t4");
    s = tabsReducer(s, { type: "pin", id: "t4", pinned: true });
    expect(s.tabs.find((t) => t.id === "t4")).toMatchObject({ pinned: true, preview: false });
    s = open(s, page("c"), "t5");
    s = tabsReducer(s, { type: "duplicate", id: "t5", newId: "t6" });
    expect(s.tabs.filter((t) => t.preview)).toHaveLength(0);
    s = open(s, page("d"), "t7");
    s = tabsReducer(s, { type: "move", id: "t7", toIndex: 1 });
    expect(s.tabs.find((t) => t.id === "t7")?.preview).toBe(false);
    const allPreview = { ...s, tabs: s.tabs.map((t) => ({ ...t, preview: true })) };
    expect(tabsReducer(s, { type: "replace", state: allPreview }).tabs.filter((t) => t.preview)).toHaveLength(
      1,
    );
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

test("closedTargets lists the targets that left the state, pinned tabs excluded by the reducer", () => {
  const state: TabsState = {
    tabs: [
      { id: "a", target: page("1"), pinned: true, preview: false },
      { id: "b", target: page("2"), pinned: false, preview: false },
      { id: "c", target: page("3"), pinned: false, preview: false },
    ],
    activeId: "b",
    recents: [],
  };
  expect(closedTargets(state, tabsReducer(state, { type: "close", id: "b" }))).toEqual([page("2")]);
  expect(closedTargets(state, tabsReducer(state, { type: "closeOthers", id: "c" }))).toEqual([page("2")]);
  expect(closedTargets(state, tabsReducer(state, { type: "close", id: "a" }))).toEqual([]);
  expect(closedTargets(state, tabsReducer(state, { type: "activate", id: "c" }))).toEqual([]);
});

test("⌘⇧T asks to reopen the last closed tab", () => {
  const base = { metaKey: true, ctrlKey: false, altKey: false, shiftKey: true };
  expect(shortcutFor({ ...base, key: "T" }, true)).toEqual({ kind: "reopen" });
  expect(shortcutFor({ ...base, key: "t" }, true)).toEqual({ kind: "reopen" });
  expect(shortcutFor({ ...base, key: "p" }, true)).toEqual({ kind: "togglePin" });
  expect(shortcutFor({ ...base, metaKey: false, ctrlKey: true, key: "t" }, false)).toEqual({
    kind: "reopen",
  });
});

test("retarget swaps a tab's target in place, or falls back to the tab already showing it", () => {
  const project: TabTarget = { kind: "project", projectId: "p1" };
  let s = tabsReducer(EMPTY_TABS, { type: "open", target: project, newTab: true, id: "t1" });
  s = tabsReducer(s, { type: "retarget", id: "t1", target: page("dash") });
  expect(s.tabs).toEqual([{ id: "t1", target: page("dash"), pinned: false, preview: false }]);
  expect(s.activeId).toBe("t1");
  expect(s.recents[0]).toEqual(page("dash"));
  s = tabsReducer(s, { type: "open", target: project, newTab: true, id: "t2" });
  s = tabsReducer(s, { type: "retarget", id: "t2", target: page("dash") });
  expect(s.tabs.map((t) => t.id)).toEqual(["t1"]);
  expect(s.activeId).toBe("t1");
});
