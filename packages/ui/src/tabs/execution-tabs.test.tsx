import { expect, test } from "bun:test";
import type { AgentExecution, TabsState, TabTarget } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";
import type { TabsAction } from "./tabs-model";
import { useShownTabs } from "./use-shown-tabs";
import type { TabsApi } from "./use-tabs";

const page: TabTarget = { kind: "page", projectId: "p1", pageId: "1@2" };
const agents: TabTarget = { kind: "screen", screen: "agents" };
const run: TabTarget = { kind: "run", runId: "r1" };
const skill: TabTarget = { kind: "skill", skillId: "superpowers:brainstorming" };
const notes: TabTarget = { kind: "page", projectId: "p1", pageId: "3@2" };

const state = (activeId: string): TabsState => ({
  tabs: [
    { id: "a", target: agents, pinned: false, preview: false },
    { id: "k", target: page, pinned: false, preview: false },
    { id: "r", target: run, pinned: false, preview: false },
    { id: "s", target: skill, pinned: false, preview: false },
    { id: "n", target: notes, pinned: false, preview: false },
  ],
  activeId,
  recents: [agents, page],
});

function shownTabs(execution: AgentExecution, activeId = "k") {
  const actions: TabsAction[] = [];
  const api: TabsApi = {
    state: state(activeId),
    error: null,
    dispatch: (action) => actions.push(action),
    open: () => undefined,
    closed: [],
    reopen: () => undefined,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>{children}</AppSettingsProvider>
  );
  const { result } = renderHook(() => useShownTabs(api), { wrapper });
  return { tabs: result.current, actions };
}

const ids = (tabs: TabsApi) => tabs.state.tabs.map((t) => t.id);

test("hidden execution: an open Agents, run or skill tab is not shown in the tab bar", () => {
  const { tabs } = shownTabs("hidden");
  expect(ids(tabs)).toEqual(["k", "n"]);
  expect(tabs.state.recents).toEqual([page]);
});

test("shown execution: the Agents, run and skill tabs come back", () => {
  const { tabs } = shownTabs("shown");
  expect(ids(tabs)).toEqual(["a", "k", "r", "s", "n"]);
  expect(tabs.state.recents).toEqual([agents, page]);
});

test("hidden execution: an execution tab opened on purpose stays while it is the active one", () => {
  expect(ids(shownTabs("hidden", "a").tabs)).toEqual(["a", "k", "n"]);
});

test("hidden execution: ⌘2 and a drag aim at the shown tabs", () => {
  const { tabs, actions } = shownTabs("hidden");
  tabs.dispatch({ type: "activateIndex", index: 2 });
  tabs.dispatch({ type: "move", id: "k", toIndex: 1 });
  expect(actions).toEqual([
    { type: "activate", id: "n" },
    { type: "move", id: "k", toIndex: 4 },
  ]);
});
