import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  type ProjectSnapshot,
  type ProjectSummary,
  type RpcRequest,
  type TabsState,
  type TabTarget,
} from "@kibo/schema";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  nextTicketKey: "KIB-1",
};
const ctx = { projects: [summary], snapshots: new Map([["p1", snapshot]]) };
const state: TabsState = {
  tabs: [
    { id: "pinned", target: { kind: "project", projectId: "p1" }, pinned: true },
    { id: "board", target: { kind: "page", projectId: "p1", pageId: "1@1" }, pinned: false },
    { id: "changes", target: { kind: "changes", projectId: "p1", worktree: null }, pinned: false },
    { id: "gone", target: { kind: "page", projectId: "p1", pageId: "9@9" }, pinned: false },
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

test("useTabs loads the stored state and saves changes after a debounce", async () => {
  stored = state;
  const { result } = renderHook(() => useTabs());
  await waitFor(() => expect(result.current?.state).toEqual(state));
  expect(saved).toHaveLength(0);
  act(() => result.current?.dispatch({ type: "activate", id: "changes" }));
  await waitFor(() => expect(saved).toHaveLength(1), { timeout: 1000 });
  expect(saved[0]).toEqual({ method: "saveTabs", state: { ...state, activeId: "changes" } });
});
