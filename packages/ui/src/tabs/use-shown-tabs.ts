import type { Tab, TabsState, TabTarget } from "@kibo/schema";
import { useMemo } from "react";
import { retiredRoute } from "../shell/retired-routes";
import type { TabsAction } from "./tabs-model";
import { targetToHash } from "./target-hash";
import type { TabsApi } from "./use-tabs";

const isRetiredTab = (target: TabTarget): boolean => retiredRoute(targetToHash(target)) !== null;

const hiddenTab = (state: TabsState) => (tab: Tab) => tab.id !== state.activeId && isRetiredTab(tab.target);

function withoutExecutionTabs(state: TabsState): TabsState {
  const hidden = hiddenTab(state);
  return {
    ...state,
    tabs: state.tabs.filter((t) => !hidden(t)),
    recents: state.recents.filter((r) => !isRetiredTab(r)),
  };
}

function fullIndex(all: Tab[], shown: Tab[], id: string, toIndex: number): number {
  const rest = all.filter((t) => t.id !== id);
  const shownRest = shown.filter((t) => t.id !== id);
  if (toIndex <= 0) {
    const first = shownRest[0];
    return first ? rest.indexOf(first) : 0;
  }
  const before = shownRest[Math.min(toIndex, shownRest.length) - 1];
  return before ? rest.indexOf(before) + 1 : rest.length;
}

function shownAction(all: TabsState, shown: TabsState, action: TabsAction): TabsAction | null {
  if (action.type === "activateIndex" && action.index > 0) {
    const tab = action.index >= 8 ? shown.tabs.at(-1) : shown.tabs[action.index - 1];
    return tab ? { type: "activate", id: tab.id } : null;
  }
  if (action.type === "move")
    return { ...action, toIndex: fullIndex(all.tabs, shown.tabs, action.id, action.toIndex) };
  return action;
}

export function useShownTabs(tabs: TabsApi): TabsApi {
  return useMemo(() => {
    const state = withoutExecutionTabs(tabs.state);
    const dispatch = (action: TabsAction) => {
      const next = shownAction(tabs.state, state, action);
      if (next) tabs.dispatch(next);
    };
    return { ...tabs, state, dispatch };
  }, [tabs]);
}
