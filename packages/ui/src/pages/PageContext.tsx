import type { ComponentSummary } from "@kibo/schema";
import { createSpotlightStore, type SpotlightApi } from "@kibo/sdk";
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { useComponents } from "../state/use-components";
import { type FocusAction, focusReducer } from "./focus-mode";
import { createSelectionBus, type SelectionBus } from "./selection-bus";

export type PageState = {
  focusedId: string | null;
  dispatch(action: FocusAction): void;
  bus: SelectionBus;
  components: ComponentSummary[] | null;
  spotlight: SpotlightApi;
};

export const PageContext = createContext<PageState | null>(null);

export const usePageContext = (): PageState | null => useContext(PageContext);

export function usePageState(focusable: readonly string[], question: string | null = null): PageState {
  const [bus] = useState(createSelectionBus);
  const [spotlight] = useState(createSpotlightStore);
  useEffect(
    () => spotlight.set(question === null ? null : { kind: "question", id: question }),
    [spotlight, question],
  );
  const { components, error } = useComponents();
  const known = error ? [] : components;
  const [requested, dispatch] = useReducer(focusReducer, null);
  const present = requested !== null && focusable.includes(requested);
  const focusedId = present ? requested : null;
  useEffect(() => {
    if (requested !== null && !present) dispatch({ type: "exit", id: requested });
  }, [requested, present]);
  return useMemo(
    () => ({ focusedId, dispatch, bus, components: known, spotlight }),
    [focusedId, bus, known, spotlight],
  );
}
