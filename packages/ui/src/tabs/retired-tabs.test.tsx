import { expect, test } from "bun:test";
import type { TabsState, TabTarget } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import type { TabsAction } from "./tabs-model";
import { useShownTabs } from "./use-shown-tabs";
import type { TabsApi } from "./use-tabs";

const page: TabTarget = { kind: "page", projectId: "p1", pageId: "1@2" };
const domains: TabTarget = { kind: "screen", screen: "domains" };
const components: TabTarget = { kind: "screen", screen: "components" };
const sources: TabTarget = { kind: "screen", screen: "sources" };
const notes: TabTarget = { kind: "page", projectId: "p1", pageId: "3@2" };

const state = (activeId: string): TabsState => ({
  tabs: [
    { id: "a", target: domains, pinned: false, preview: false },
    { id: "k", target: page, pinned: false, preview: false },
    { id: "r", target: components, pinned: false, preview: false },
    { id: "s", target: sources, pinned: false, preview: false },
    { id: "n", target: notes, pinned: false, preview: false },
  ],
  activeId,
  recents: [domains, page],
});

function shownTabs(activeId = "k") {
  const actions: TabsAction[] = [];
  const api: TabsApi = {
    state: state(activeId),
    error: null,
    dispatch: (action) => actions.push(action),
    open: () => undefined,
    closed: [],
    reopen: () => undefined,
  };
  const { result } = renderHook(() => useShownTabs(api));
  return { tabs: result.current, actions };
}

const ids = (tabs: TabsApi) => tabs.state.tabs.map((t) => t.id);

test("an open Domaines, Composants or Sources tab is not shown in the tab bar", () => {
  const { tabs } = shownTabs();
  expect(ids(tabs)).toEqual(["k", "n"]);
  expect(tabs.state.recents).toEqual([page]);
});

test("a retired tab opened on purpose stays while it is the active one", () => {
  expect(ids(shownTabs("a").tabs)).toEqual(["a", "k", "n"]);
});

test("⌘2 and a drag aim at the shown tabs", () => {
  const { tabs, actions } = shownTabs();
  tabs.dispatch({ type: "activateIndex", index: 2 });
  tabs.dispatch({ type: "move", id: "k", toIndex: 1 });
  expect(actions).toEqual([
    { type: "activate", id: "n" },
    { type: "move", id: "k", toIndex: 4 },
  ]);
});
