import type { Spotlight } from "@kibo/schema";
import { createSpotlightStore, type SpotlightApi } from "@kibo/sdk";
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { type FocusAction, focusReducer } from "./focus-mode";
import { createSelectionBus, type SelectionBus } from "./selection-bus";

export type PageState = {
  focusedId: string | null;
  dispatch(action: FocusAction): void;
  bus: SelectionBus;
  spotlight: SpotlightApi;
};

export const PageContext = createContext<PageState | null>(null);

export const usePageContext = (): PageState | null => useContext(PageContext);

export function usePageState(focusable: readonly string[], target: Spotlight | null = null): PageState {
  const [bus] = useState(createSelectionBus);
  const [spotlight] = useState(createSpotlightStore);
  useEffect(() => spotlight.set(target), [spotlight, target]);
  const [requested, dispatch] = useReducer(focusReducer, null);
  const present = requested !== null && focusable.includes(requested);
  const focusedId = present ? requested : null;
  useEffect(() => {
    if (requested !== null && !present) dispatch({ type: "exit", id: requested });
  }, [requested, present]);
  return useMemo(() => ({ focusedId, dispatch, bus, spotlight }), [focusedId, bus, spotlight]);
}
