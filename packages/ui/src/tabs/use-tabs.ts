import { EMPTY_TABS, KiboError, type TabsState, type TabTarget } from "@kibo/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { type TabsAction, tabsReducer } from "./tabs-model";

export type TabsApi = {
  state: TabsState;
  error: string | null;
  dispatch(action: TabsAction): void;
  open(target: TabTarget | null, opts?: { newTab?: boolean }): void;
};

export function useTabs(): TabsApi | null {
  const [state, setState] = useState<TabsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getTabs" }).then(
      (s) => {
        if (!alive) return;
        lastSaved.current = JSON.stringify(s);
        setState(s);
      },
      (e: unknown) => {
        if (!alive || (e instanceof KiboError && e.code === "UNAUTHORIZED")) return;
        lastSaved.current = JSON.stringify(EMPTY_TABS);
        setState(EMPTY_TABS);
        setError(fr.tabs.loadFailed);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSaved.current) return;
    const timer = setTimeout(() => {
      client.rpc({ method: "saveTabs", state }).then(
        () => {
          lastSaved.current = serialized;
          setError(null);
        },
        () => setError(fr.tabs.saveFailed),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);

  const dispatch = useCallback((action: TabsAction) => setState((s) => (s ? tabsReducer(s, action) : s)), []);
  const open = useCallback(
    (target: TabTarget | null, opts: { newTab?: boolean } = {}) =>
      dispatch(
        target === null
          ? { type: "activate", id: null }
          : { type: "open", target, newTab: opts.newTab ?? false, id: crypto.randomUUID() },
      ),
    [dispatch],
  );
  return useMemo(() => (state ? { state, error, dispatch, open } : null), [state, error, dispatch, open]);
}
