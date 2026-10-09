import { EMPTY_TABS, KiboError, type TabsState, type TabTarget } from "@kibo/schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { closedTargets, sameTarget, type TabsAction, tabsReducer } from "./tabs-model";

export type TabsApi = {
  state: TabsState;
  error: string | null;
  dispatch(action: TabsAction): void;
  open(target: TabTarget | null, opts?: { newTab?: boolean; keep?: boolean }): void;
  closed: readonly TabTarget[];
  reopen(): void;
};

type TabsMemory = { tabs: TabsState; closed: TabTarget[] };

const MAX_CLOSED = 10;
const CLOSING: ReadonlySet<TabsAction["type"]> = new Set(["close", "closeOthers", "closeRight"]);

const inProject = (target: TabTarget, projectId: string): boolean =>
  target.kind !== "screen" && target.projectId === projectId;

function applyAction(s: TabsMemory, action: TabsAction): TabsMemory {
  const tabs = tabsReducer(s.tabs, action);
  if (action.type === "closeProject")
    return { ...s, tabs, closed: s.closed.filter((t) => !inProject(t, action.projectId)) };
  const gone = CLOSING.has(action.type) ? closedTargets(s.tabs, tabs) : [];
  if (gone.length === 0) return { ...s, tabs };
  return { tabs, closed: [...gone.reverse(), ...s.closed].slice(0, MAX_CLOSED) };
}

function reopenLast(s: TabsMemory, id: string): TabsMemory {
  const [last, ...closed] = s.closed;
  if (!last) return s;
  const tabs = tabsReducer(s.tabs, { type: "open", target: last, newTab: true, id });
  const shown = tabs.tabs.some((t) => t.id === tabs.activeId && sameTarget(t.target, last));
  return shown ? { ...s, tabs, closed } : s;
}

export function useTabs(): TabsApi | null {
  const [all, setAll] = useState<TabsMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);
  const state = all?.tabs ?? null;

  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getTabs" }).then(
      (s) => {
        if (!alive) return;
        lastSaved.current = JSON.stringify(s);
        setAll({ tabs: s, closed: [] });
      },
      (e: unknown) => {
        if (!alive || (e instanceof KiboError && e.code === "UNAUTHORIZED")) return;
        lastSaved.current = JSON.stringify(EMPTY_TABS);
        setAll({ tabs: EMPTY_TABS, closed: [] });
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

  const dispatch = useCallback((action: TabsAction) => setAll((s) => (s ? applyAction(s, action) : s)), []);
  const reopen = useCallback(() => {
    const id = crypto.randomUUID();
    setAll((s) => (s ? reopenLast(s, id) : s));
  }, []);
  const open = useCallback(
    (target: TabTarget | null, opts: { newTab?: boolean; keep?: boolean } = {}) =>
      dispatch(
        target === null
          ? { type: "activate", id: null }
          : {
              type: "open",
              target,
              newTab: opts.newTab ?? false,
              id: crypto.randomUUID(),
              ...(opts.keep !== undefined && { keep: opts.keep }),
            },
      ),
    [dispatch],
  );
  return useMemo(
    () => (all ? { state: all.tabs, error, dispatch, open, closed: all.closed, reopen } : null),
    [all, error, dispatch, open, reopen],
  );
}
