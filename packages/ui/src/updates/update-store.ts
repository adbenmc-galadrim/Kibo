import { IDLE, reduceUpdate, type UpdateEvent, type UpdateInfo, type UpdateStatus } from "./update-state";

export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export type UpdaterPort = {
  installedVersion(): Promise<string>;
  check(): Promise<UpdateInfo | null>;
  backup(): Promise<void>;
  downloadAndInstall(onEvent: (event: DownloadEvent) => void): Promise<void>;
  relaunch(): Promise<void>;
};

export type UpdateSnapshot = { installed: string | null; status: UpdateStatus };

export type UpdateStore = {
  snapshot(): UpdateSnapshot;
  subscribe(listener: () => void): () => void;
  loadInstalled(): Promise<void>;
  check(): Promise<void>;
  install(): Promise<void>;
};

const detailOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function downloadEventToUpdateEvent(event: DownloadEvent): UpdateEvent {
  if (event.event === "Started") return { type: "started", total: event.data.contentLength ?? null };
  if (event.event === "Progress") return { type: "progress", chunk: event.data.chunkLength };
  return { type: "downloaded" };
}

export function createUpdateStore(port: UpdaterPort, now: () => number = Date.now): UpdateStore {
  let current: UpdateSnapshot = { installed: null, status: IDLE };
  const listeners = new Set<() => void>();
  let installedLoad: Promise<void> | null = null;
  let checking: Promise<void> | null = null;

  const publish = (next: UpdateSnapshot) => {
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener();
  };
  const dispatch = (event: UpdateEvent) => {
    const status = reduceUpdate(current.status, event);
    if (status !== current.status) publish({ ...current, status });
  };

  const check = async (): Promise<void> => {
    if (checking) return checking;
    dispatch({ type: "check" });
    checking = port.check().then(
      (update) => dispatch(update ? { type: "found", update } : { type: "none", at: now() }),
      (e: unknown) => dispatch({ type: "checkFailed", detail: detailOf(e) }),
    );
    await checking;
    checking = null;
  };

  const install = async (): Promise<void> => {
    const status = reduceUpdate(current.status, { type: "install" });
    if (status === current.status) return;
    publish({ ...current, status });
    try {
      await port.backup();
    } catch (e) {
      dispatch({ type: "backupFailed", detail: detailOf(e) });
      return;
    }
    dispatch({ type: "backedUp" });
    try {
      await port.downloadAndInstall((event) => dispatch(downloadEventToUpdateEvent(event)));
      dispatch({ type: "downloaded" });
      await port.relaunch();
    } catch (e) {
      dispatch({ type: "installFailed", detail: detailOf(e) });
    }
  };

  return {
    snapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadInstalled() {
      installedLoad ??= port.installedVersion().then(
        (installed) => publish({ ...current, installed }),
        (e: unknown) => console.error("[kibo-ui] installed version unavailable", e),
      );
      return installedLoad;
    },
    check,
    install,
  };
}
