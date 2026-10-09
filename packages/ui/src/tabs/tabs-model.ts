import { MAX_RECENTS, MAX_TABS, singlePreview, type Tab, type TabsState, type TabTarget } from "@kibo/schema";
import { targetToHash } from "./target-hash";

export type TabsAction =
  | { type: "open"; target: TabTarget; newTab: boolean; id: string; keep?: boolean }
  | { type: "keep"; id: string }
  | { type: "activate"; id: string | null }
  | { type: "activateIndex"; index: number }
  | { type: "close"; id: string }
  | { type: "closeOthers"; id: string }
  | { type: "closeRight"; id: string }
  | { type: "closeProject"; projectId: string }
  | { type: "pin"; id: string; pinned: boolean }
  | { type: "duplicate"; id: string; newId: string }
  | { type: "move"; id: string; toIndex: number }
  | { type: "retarget"; id: string; target: TabTarget }
  | { type: "replace"; state: TabsState };

export const sameTarget = (a: TabTarget, b: TabTarget): boolean => targetToHash(a) === targetToHash(b);

export const activeTarget = (s: TabsState): TabTarget | null =>
  s.tabs.find((t) => t.id === s.activeId)?.target ?? null;

const pinnedFirst = (tabs: Tab[]): Tab[] => [
  ...tabs.filter((t) => t.pinned),
  ...tabs.filter((t) => !t.pinned),
];

const remember = (recents: TabTarget[], target: TabTarget): TabTarget[] =>
  [target, ...recents.filter((r) => !sameTarget(r, target))].slice(0, MAX_RECENTS);

function closeIds(state: TabsState, ids: Set<string>): TabsState {
  const tabs = state.tabs.filter((t) => !ids.has(t.id));
  if (!state.activeId || !ids.has(state.activeId)) return { ...state, tabs };
  const index = state.tabs.findIndex((t) => t.id === state.activeId);
  const right = state.tabs.slice(index + 1).find((t) => !ids.has(t.id));
  const left = [...state.tabs.slice(0, index)].reverse().find((t) => !ids.has(t.id));
  return { ...state, tabs, activeId: (right ?? left)?.id ?? null };
}

const permanent = (tabs: Tab[], id: string): Tab[] =>
  tabs.map((t) => (t.id === id ? { ...t, preview: false } : t));

function openTarget(
  state: TabsState,
  target: TabTarget,
  newTab: boolean,
  id: string,
  keep: boolean,
): TabsState {
  const recents = remember(state.recents, target);
  const existing = state.tabs.find((t) => sameTarget(t.target, target));
  if (existing) {
    return {
      ...state,
      tabs: keep ? permanent(state.tabs, existing.id) : state.tabs,
      activeId: existing.id,
      recents,
    };
  }
  const preview = state.tabs.find((t) => t.preview);
  if (!newTab && preview) {
    const tabs = state.tabs.map((t) => (t.id === preview.id ? { ...t, target, preview: !keep } : t));
    return { ...state, tabs, activeId: preview.id, recents };
  }
  let tabs = state.tabs;
  if (tabs.length >= MAX_TABS) {
    const victim = tabs.find((t) => !t.pinned && t.id !== state.activeId);
    if (!victim) return { ...state, recents };
    tabs = tabs.filter((t) => t.id !== victim.id);
  }
  return { tabs: [...tabs, { id, target, pinned: false, preview: !keep }], activeId: id, recents };
}

function move(state: TabsState, id: string, toIndex: number): TabsState {
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return state;
  const rest = state.tabs.filter((t) => t.id !== id);
  const pinnedCount = rest.filter((t) => t.pinned).length;
  const [min, max] = tab.pinned ? [0, pinnedCount] : [pinnedCount, rest.length];
  const at = Math.min(max, Math.max(min, toIndex));
  return { ...state, tabs: [...rest.slice(0, at), { ...tab, preview: false }, ...rest.slice(at)] };
}

function retarget(state: TabsState, id: string, target: TabTarget): TabsState {
  if (!state.tabs.some((t) => t.id === id)) return state;
  const recents = remember(state.recents, target);
  const existing = state.tabs.find((t) => t.id !== id && sameTarget(t.target, target));
  if (existing) return { ...closeIds(state, new Set([id])), activeId: existing.id, recents };
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, target } : t)), recents };
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "open":
      return openTarget(state, action.target, action.newTab, action.id, action.keep ?? action.newTab);
    case "keep":
      return { ...state, tabs: permanent(state.tabs, action.id) };
    case "activate":
      return action.id === null || state.tabs.some((t) => t.id === action.id)
        ? { ...state, activeId: action.id }
        : state;
    case "activateIndex": {
      if (action.index === 0) return { ...state, activeId: null };
      const tab = action.index >= 8 ? state.tabs.at(-1) : state.tabs[action.index - 1];
      return tab ? { ...state, activeId: tab.id } : state;
    }
    case "close": {
      const tab = state.tabs.find((t) => t.id === action.id);
      return tab && !tab.pinned ? closeIds(state, new Set([tab.id])) : state;
    }
    case "closeOthers":
      if (!state.tabs.some((t) => t.id === action.id)) return state;
      return {
        ...closeIds(
          state,
          new Set(state.tabs.filter((t) => !t.pinned && t.id !== action.id).map((t) => t.id)),
        ),
        activeId: action.id,
      };
    case "closeRight": {
      const index = state.tabs.findIndex((t) => t.id === action.id);
      if (index < 0) return state;
      const ids = new Set(
        state.tabs
          .slice(index + 1)
          .filter((t) => !t.pinned)
          .map((t) => t.id),
      );
      return closeIds(
        { ...state, activeId: ids.has(state.activeId ?? "") ? action.id : state.activeId },
        ids,
      );
    }
    case "closeProject": {
      const ofProject = (target: TabTarget) =>
        target.kind !== "screen" && target.projectId === action.projectId;
      const ids = new Set(state.tabs.filter((t) => ofProject(t.target)).map((t) => t.id));
      const recents = state.recents.filter((r) => !ofProject(r));
      if (ids.size === 0 && recents.length === state.recents.length) return state;
      return { ...closeIds(state, ids), recents };
    }
    case "pin":
      return {
        ...state,
        tabs: pinnedFirst(
          state.tabs.map((t) => (t.id === action.id ? { ...t, pinned: action.pinned, preview: false } : t)),
        ),
      };
    case "duplicate": {
      const index = state.tabs.findIndex((t) => t.id === action.id);
      const tab = state.tabs[index];
      if (!tab || state.tabs.length >= MAX_TABS) return state;
      const copy = { id: action.newId, target: tab.target, pinned: false, preview: false };
      const tabs = permanent(state.tabs, action.id);
      return {
        ...state,
        tabs: pinnedFirst([...tabs.slice(0, index + 1), copy, ...tabs.slice(index + 1)]),
        activeId: copy.id,
      };
    }
    case "move":
      return move(state, action.id, action.toIndex);
    case "retarget":
      return retarget(state, action.id, action.target);
    case "replace":
      return { ...action.state, tabs: singlePreview(action.state.tabs) };
  }
}

export function closedTargets(before: TabsState, after: TabsState): TabTarget[] {
  const kept = new Set(after.tabs.map((t) => t.id));
  return before.tabs.filter((t) => !kept.has(t.id)).map((t) => t.target);
}
