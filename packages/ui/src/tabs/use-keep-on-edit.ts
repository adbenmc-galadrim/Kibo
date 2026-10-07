import { useEffect } from "react";
import { onWrite } from "../api";
import type { TabsApi } from "./use-tabs";

export function useKeepOnEdit(tabs: TabsApi, dialogOpen: boolean): void {
  const { state, dispatch } = tabs;
  useEffect(
    () =>
      onWrite((projectId) => {
        if (dialogOpen) return;
        const active = state.tabs.find((t) => t.id === state.activeId);
        if (!active?.preview || active.target.kind === "screen") return;
        if (active.target.projectId !== projectId) return;
        dispatch({ type: "keep", id: active.id });
      }),
    [state, dispatch, dialogOpen],
  );
}
