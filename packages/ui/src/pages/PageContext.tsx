import { createContext, useContext, useMemo, useReducer, useState } from "react";
import { type FocusAction, focusReducer } from "./focus-mode";
import { createSelectionBus, type SelectionBus } from "./selection-bus";

export type PageState = { focusedId: string | null; dispatch(action: FocusAction): void; bus: SelectionBus };

export const PageContext = createContext<PageState | null>(null);

export const usePageContext = (): PageState | null => useContext(PageContext);

export function usePageState(focusable: readonly string[]): PageState {
  const [bus] = useState(createSelectionBus);
  const [requested, dispatch] = useReducer(focusReducer, null);
  const focusedId = requested !== null && focusable.includes(requested) ? requested : null;
  return useMemo(() => ({ focusedId, dispatch, bus }), [focusedId, bus]);
}
