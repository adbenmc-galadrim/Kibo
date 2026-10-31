import { KiboError, type ProjectSnapshot } from "@kibo/schema";
import { client, onUnauthorized, onWriteDone } from "../api";

const REFRESH_GROUPING_MS = 100;

type Unsubscribe = () => void;

type ProjectStoreDeps = {
  getProject(projectId: string): Promise<ProjectSnapshot>;
  subscribe(listener: (projectId: string | null) => void): Unsubscribe;
  online(): boolean;
  onConnection(listener: () => void): Unsubscribe;
  onUnauthorized(listener: () => void): Unsubscribe;
  onWriteDone(listener: (projectId: string | null) => void): Unsubscribe;
};

type Slot = {
  view: ProjectSnapshot | null;
  stale: boolean;
  loading: Promise<ProjectSnapshot> | null;
  refresh: Promise<ProjectSnapshot> | null;
};

const hasCode = (e: unknown, code: string) => e instanceof KiboError && e.code === code;

function reportFailedRefresh(e: unknown): void {
  if (hasCode(e, "UNAUTHORIZED") || hasCode(e, "NOT_FOUND")) return;
  console.error("[kibo] project refresh failed", e);
}

export function createProjectStore(deps: ProjectStoreDeps) {
  let slots = new Map<string, Slot>();
  const listeners = new Set<() => void>();
  const watchers = new Map<string, number>();
  let disconnect: Unsubscribe | null = null;

  const publish = () => {
    for (const l of listeners) l();
  };

  const load = (projectId: string, slot: Slot): Promise<ProjectSnapshot> => {
    slot.stale = false;
    const kept = () => slots.get(projectId) === slot;
    const loading: Promise<ProjectSnapshot> = deps
      .getProject(projectId)
      .then(
        (view) => {
          if (kept()) {
            slot.view = view;
            publish();
          }
          return view;
        },
        (e: unknown) => {
          slot.stale = true;
          if (kept() && hasCode(e, "NOT_FOUND") && slot.view) {
            slot.view = null;
            publish();
          }
          throw e;
        },
      )
      .finally(() => {
        if (slot.loading === loading) slot.loading = null;
      });
    slot.loading = loading;
    return loading;
  };

  const invalidate = (projectId: string | null) => {
    const slot = projectId === null ? undefined : slots.get(projectId);
    if (!slot || projectId === null) return;
    slot.stale = true;
    if (slot.refresh) return;
    const refresh = new Promise<ProjectSnapshot>((resolve, reject) => {
      setTimeout(() => {
        slot.refresh = null;
        const reload = () => load(projectId, slot);
        (slot.loading ? slot.loading.then(reload, reload) : reload()).then(resolve, reject);
      }, REFRESH_GROUPING_MS);
    });
    slot.refresh = refresh;
    refresh.catch(reportFailedRefresh);
  };

  const clear = () => {
    const hadView = [...slots.values()].some((slot) => slot.view);
    slots = new Map();
    if (hadView) publish();
  };

  const ensure = (projectId: string): Promise<ProjectSnapshot> => {
    connect();
    let slot = slots.get(projectId);
    if (!slot) {
      slot = { view: null, stale: false, loading: null, refresh: null };
      slots.set(projectId, slot);
    }
    if (slot.refresh) return slot.refresh;
    if (slot.loading) return slot.loading;
    if (slot.view && !slot.stale) return Promise.resolve(slot.view);
    return load(projectId, slot);
  };

  const followConnection = () => {
    if (!deps.online()) {
      clear();
      return;
    }
    for (const id of watchers.keys()) ensure(id).catch(reportFailedRefresh);
  };

  function connect(): void {
    if (disconnect) return;
    const offs = [
      deps.subscribe(invalidate),
      deps.onWriteDone(invalidate),
      deps.onConnection(followConnection),
      deps.onUnauthorized(() => {
        clear();
        disconnect?.();
      }),
    ];
    disconnect = () => {
      disconnect = null;
      for (const off of offs) off();
    };
  }

  return {
    connect,
    ensure,
    clear,
    peek: (projectId: string): ProjectSnapshot | null => slots.get(projectId)?.view ?? null,
    subscribe(listener: () => void): Unsubscribe {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    watch(projectId: string): Unsubscribe {
      connect();
      watchers.set(projectId, (watchers.get(projectId) ?? 0) + 1);
      return () => {
        const left = (watchers.get(projectId) ?? 1) - 1;
        if (left > 0) watchers.set(projectId, left);
        else watchers.delete(projectId);
      };
    },
  };
}

export const projectStore = createProjectStore({
  getProject: (projectId) => client.rpc({ method: "getProject", projectId }),
  subscribe: (listener) => client.subscribe(listener),
  online: () => client.online(),
  onConnection: (listener) => client.onConnection(listener),
  onUnauthorized,
  onWriteDone,
});

export function projectSnapshotSource(projectId: string): () => Promise<ProjectSnapshot> {
  projectStore.connect();
  return () => projectStore.ensure(projectId);
}
