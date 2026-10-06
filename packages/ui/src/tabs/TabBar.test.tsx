import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  MAX_TABS,
  type ProjectSnapshot,
  type ProjectSummary,
  type RpcRequest,
  type TabsState,
  type TabTarget,
} from "@kibo/schema";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isMac, shortcutLabel } from "../lib/shortcut-label";
import type { TabsAction } from "./tabs-model";

const saved: RpcRequest[] = [];
let stored: TabsState = { tabs: [], activeId: null, recents: [] };
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      if (req.method === "getTabs") return Promise.resolve(stored);
      saved.push(req);
      return Promise.resolve(null);
    },
  },
}));
const { TabBar } = await import("./TabBar");
const { describeTarget } = await import("./tab-title");
const unmockedModule = "./use-tabs?unmocked";
const { useTabs }: typeof import("./use-tabs") = await import(unmockedModule);

const summary: ProjectSummary = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: "/repo",
  color: "#F97316",
  counts: { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 },
};
const snapshot: ProjectSnapshot = {
  meta: summary,
  workflow: DEFAULT_WORKFLOW,
  pages: [{ id: "1@1", title: "Kanban", kind: "view", parentId: null }],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};
const ctx = { projects: [summary], snapshots: new Map([["p1", snapshot]]) };
const state: TabsState = {
  tabs: [
    { id: "pinned", target: { kind: "project", projectId: "p1" }, pinned: true, preview: false },
    { id: "board", target: { kind: "page", projectId: "p1", pageId: "1@1" }, pinned: false, preview: false },
    {
      id: "changes",
      target: { kind: "changes", projectId: "p1", worktree: null },
      pinned: false,
      preview: false,
    },
    { id: "gone", target: { kind: "page", projectId: "p1", pageId: "9@9" }, pinned: false, preview: false },
  ],
  activeId: "board",
  recents: [],
};

beforeEach(() => {
  saved.length = 0;
});

function renderBar(onOpenWindow: ((t: TabTarget) => void) | null = null) {
  const actions: TabsAction[] = [];
  render(
    <TabBar
      state={state}
      describe={(t) => describeTarget(t, ctx)}
      isDirty={(t) => t.kind === "changes"}
      dispatch={(a) => actions.push(a)}
      onNewTab={() => actions.push({ type: "activate", id: "new" })}
      onOpenWindow={onOpenWindow}
      error={null}
    />,
  );
  return actions;
}

test("titles follow « Projet · Page », pinned tabs are compact, missing targets are named", () => {
  renderBar();
  const bar = screen.getByRole("tablist", { name: "Onglets" });
  expect(within(bar).getByRole("tab", { name: "Accueil" }).getAttribute("aria-selected")).toBe("false");
  expect(within(bar).getByRole("tab", { name: "Kibo · Kanban" }).getAttribute("aria-selected")).toBe("true");
  expect(within(bar).getByRole("tab", { name: "Kibo" }).textContent).toBe("");
  expect(within(bar).getByRole("tab", { name: "Page introuvable" })).toBeTruthy();
  expect(within(bar).getByRole("img", { name: "Changements non commités" })).toBeTruthy();
  expect(within(bar).queryByRole("button", { name: "Fermer Kibo" })).toBeNull();
});

test("a screen tab is named after the screen, outside any project", () => {
  expect(describeTarget({ kind: "screen", screen: "queue" }, ctx)).toMatchObject({
    title: "Files d'attente",
    color: null,
    missing: false,
  });
  expect(describeTarget({ kind: "screen", screen: "domains" }, ctx).title).toBe("Domaines & guidelines");
});

test("click activates, the cross and the middle button close, + opens a new tab", async () => {
  const actions = renderBar();
  await userEvent.click(screen.getByRole("tab", { name: "Kibo · Changements" }));
  await userEvent.click(screen.getByRole("button", { name: "Fermer Kibo · Kanban" }));
  fireEvent(
    screen.getByRole("tab", { name: "Page introuvable" }),
    new MouseEvent("auxclick", { bubbles: true, button: 1 }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Nouvel onglet" }));
  expect(actions).toEqual([
    { type: "activate", id: "changes" },
    { type: "close", id: "board" },
    { type: "close", id: "gone" },
    { type: "activate", id: "new" },
  ]);
});

test("the context menu pins, duplicates, closes others and opens a window when allowed", async () => {
  const windows: unknown[] = [];
  const actions = renderBar((t) => windows.push(t));
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /Épingler l'onglet/ }));
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Ouvrir dans une nouvelle fenêtre" }));
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Fermer les autres onglets" }));
  expect(actions[0]).toEqual({ type: "pin", id: "board", pinned: true });
  expect(windows).toEqual([{ kind: "page", projectId: "p1", pageId: "1@1" }]);
  expect(actions[1]).toEqual({ type: "closeOthers", id: "board" });
});

test("the context menu shows the shortcuts of the running platform", async () => {
  renderBar();
  expect(screen.getByRole("tablist").closest(".select-none")).not.toBeNull();
  fireEvent.contextMenu(screen.getByRole("tab", { name: "Kibo · Kanban" }));
  const pin = await screen.findByRole("menuitem", { name: /Épingler l'onglet/ });
  expect(pin.textContent).toContain(shortcutLabel(["Shift", "P"], isMac()));
  const close = shortcutLabel(["W"], isMac());
  expect(screen.getByRole("menuitem", { name: `Fermer ${close}` })).toBeTruthy();
});

test("the tab menu content is not part of the TabBar module", async () => {
  const source = await Bun.file(new URL("./TabBar.tsx", import.meta.url)).text();
  expect(source).not.toContain("ContextMenuItem");
  expect(source).toContain("TabMenuContent");
});

test("useTabs loads the stored state and saves changes after a debounce", async () => {
  stored = state;
  const { result } = renderHook(() => useTabs());
  await waitFor(() => expect(result.current?.state).toEqual(state));
  expect(saved).toHaveLength(0);
  act(() => result.current?.dispatch({ type: "activate", id: "changes" }));
  await waitFor(() => expect(saved).toHaveLength(1), { timeout: 1000 });
  expect(saved[0]).toEqual({ method: "saveTabs", state: { ...state, activeId: "changes" } });
});

const pageTarget = (pageId: string): TabTarget => ({ kind: "page", projectId: "p1", pageId });

async function mountTabs(initial: TabsState = { tabs: [], activeId: null, recents: [] }) {
  stored = initial;
  const { result } = renderHook(() => useTabs());
  await waitFor(() => expect(result.current).not.toBeNull());
  return () => {
    if (!result.current) throw new Error("tabs not loaded");
    return result.current;
  };
}

test("useTabs keeps the last ten closed targets and reopen brings the last one back", async () => {
  const api = await mountTabs();
  act(() => api().open(pageTarget("1"), { newTab: true }));
  act(() => api().open(pageTarget("2"), { newTab: true }));
  const second = api().state.tabs[1]?.id ?? "";
  act(() => api().dispatch({ type: "close", id: second }));
  expect(api().closed).toEqual([pageTarget("2")]);
  act(() => api().reopen());
  expect(api().state.tabs.map((t) => t.target)).toEqual([pageTarget("1"), pageTarget("2")]);
  expect(api().closed).toEqual([]);
  for (let i = 0; i < 12; i++) {
    act(() => api().open(pageTarget(`x${i}`), { newTab: true }));
    const id = api().state.tabs.at(-1)?.id ?? "";
    act(() => api().dispatch({ type: "close", id }));
  }
  expect(api().closed).toHaveLength(10);
  expect(api().closed[0]).toEqual(pageTarget("x11"));
});

test("closing a project's tabs does not fill the closed pile", async () => {
  const api = await mountTabs();
  act(() => api().open(pageTarget("1"), { newTab: true }));
  act(() => api().dispatch({ type: "closeProject", projectId: "p1" }));
  expect(api().state.tabs).toEqual([]);
  expect(api().closed).toEqual([]);
});

test("closing a tab and its duplicate counts two closes", async () => {
  const api = await mountTabs();
  act(() => api().open(pageTarget("1"), { newTab: true }));
  const first = api().state.activeId ?? "";
  act(() => api().dispatch({ type: "duplicate", id: first, newId: "copy" }));
  act(() => api().dispatch({ type: "close", id: "copy" }));
  act(() => api().dispatch({ type: "close", id: first }));
  expect(api().closures).toBe(2);
  expect(api().closed).toEqual([pageTarget("1"), pageTarget("1")]);
});

const fullPinned = (count: number): TabsState => ({
  tabs: Array.from({ length: count }, (_, i) => ({
    id: `pin${i}`,
    target: pageTarget(`pin${i}`),
    pinned: true,
    preview: false,
  })),
  activeId: null,
  recents: [],
});

test("reopen keeps the pile when every tab is pinned at the limit", async () => {
  const api = await mountTabs(fullPinned(MAX_TABS - 1));
  act(() => api().open(pageTarget("gone"), { newTab: true }));
  act(() => api().dispatch({ type: "close", id: api().state.activeId ?? "" }));
  act(() => api().open(pageTarget("last"), { newTab: true }));
  act(() => api().dispatch({ type: "pin", id: api().state.activeId ?? "", pinned: true }));
  act(() => api().reopen());
  expect(api().state.tabs).toHaveLength(MAX_TABS);
  expect(api().closed).toEqual([pageTarget("gone")]);
});

test("reopen at the limit evicts an unpinned tab and opens the closed one", async () => {
  const api = await mountTabs(fullPinned(MAX_TABS - 2));
  act(() => api().open(pageTarget("gone"), { newTab: true }));
  act(() => api().dispatch({ type: "close", id: api().state.activeId ?? "" }));
  act(() => api().open(pageTarget("b"), { newTab: true }));
  act(() => api().open(pageTarget("c"), { newTab: true }));
  act(() => api().reopen());
  const targets = api().state.tabs.map((t) => t.target);
  expect(targets).toContainEqual(pageTarget("gone"));
  expect(targets).not.toContainEqual(pageTarget("b"));
  expect(api().closed).toEqual([]);
});

test("reopen activates the tab that already holds the closed target and pops it", async () => {
  const api = await mountTabs();
  act(() => api().open(pageTarget("1"), { newTab: true }));
  const first = api().state.activeId ?? "";
  act(() => api().dispatch({ type: "duplicate", id: first, newId: "copy" }));
  act(() => api().dispatch({ type: "close", id: "copy" }));
  act(() => api().open(null));
  act(() => api().reopen());
  expect(api().state.activeId).toBe(first);
  expect(api().closed).toEqual([]);
});

test("closing a project drops its targets from the closed pile", async () => {
  const api = await mountTabs();
  act(() => api().open(pageTarget("1"), { newTab: true }));
  act(() => api().open({ kind: "screen", screen: "agents" }, { newTab: true }));
  act(() => api().dispatch({ type: "close", id: api().state.tabs[0]?.id ?? "" }));
  act(() => api().dispatch({ type: "close", id: api().state.tabs[0]?.id ?? "" }));
  act(() => api().dispatch({ type: "closeProject", projectId: "p1" }));
  expect(api().closed).toEqual([{ kind: "screen", screen: "agents" }]);
});
