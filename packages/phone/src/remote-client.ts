import {
  assertRemoteAllowed,
  INDEX_PROJECT_ID,
  type PhoneEvent,
  type ProjectsIndex,
  type RemoteKeys,
  type SnapshotHeader,
} from "@kibo/remote";
import { KiboError, type RpcRequest, type RpcResult, type Topic } from "@kibo/schema";
import type { KiboClient } from "@kibo/sdk";
import { authenticatedJson } from "./authenticated";
import type { InstanceDataStore } from "./instance-data";
import { createImageCache } from "./remote-images";
import { isLocalCall, type SnapshotReader, serveLocally } from "./remote-reads";
import { actionOf, type Connectivity, createRelay, isWrite, type Refusal, reasonOf } from "./remote-relay";
import type { ServerApi } from "./server-api";
import type { SnapshotStore } from "./snapshot-store";

export type { Connectivity, Refusal } from "./remote-relay";
export type Presence = Connectivity & { stale: boolean; syncing?: boolean; lastSnapshotAt: number | null };
export type PresenceSource = { get(): Connectivity; subscribe(listener: () => void): () => void };

export type RemoteClient = KiboClient & {
  presence(): Presence;
  onPresence(listener: (presence: Presence) => void): () => void;
  sync(): Promise<void>;
  markStale(): void;
  handleEvent(event: PhoneEvent): Promise<void>;
  index(): Promise<ProjectsIndex | null>;
  onChange(listener: () => void): () => void;
  onNeedsPairing(listener: () => void): () => void;
  onRefused(listener: (refusal: Refusal) => void): () => void;
  imageUrl(projectId: string, questionId: string, imageId: string): string;
};

type RemoteClientDeps = {
  api: ServerApi;
  keys: () => RemoteKeys | null;
  snapshots: SnapshotStore;
  presence: PresenceSource;
  data: InstanceDataStore;
  now?: () => number;
  randomId?: () => string;
};

type Listeners<T> = { add(listener: T): () => void; each(call: (listener: T) => void): void };

function listeners<T>(): Listeners<T> {
  const set = new Set<T>();
  return {
    add: (listener) => {
      set.add(listener);
      return () => set.delete(listener);
    },
    each: (call) => {
      for (const l of [...set]) call(l);
    },
  };
}

const forbidden = (what: string) => new KiboError("FORBIDDEN", `${what} is not allowed from a phone`);
const noop = () => () => {};
const isoDay = (at: number) => new Date(at).toLocaleDateString("sv-SE");

export function createRemoteClient(deps: RemoteClientDeps): RemoteClient {
  const { api, snapshots: store } = deps;
  const now = deps.now ?? Date.now;
  const projectListeners = listeners<(projectId: string | null) => void>();
  const topicListeners = new Map<Topic, Listeners<() => void>>();
  const changeListeners = listeners<() => void>();
  const presenceListeners = listeners<(presence: Presence) => void>();
  const pairingListeners = listeners<() => void>();
  const refusalListeners = listeners<(refusal: Refusal) => void>();
  const images = createImageCache();

  const topic = (name: Topic) => {
    const known = topicListeners.get(name) ?? listeners<() => void>();
    topicListeners.set(name, known);
    return known;
  };

  let stale = true;
  let syncing = true;
  const presence = (): Presence => ({
    ...deps.presence.get(),
    stale,
    syncing,
    lastSnapshotAt: store.lastBuiltAt(),
  });
  const setFreshness = (next: { stale: boolean; syncing: boolean }) => {
    if (stale === next.stale && syncing === next.syncing) return;
    stale = next.stale;
    syncing = next.syncing;
    presenceListeners.each((l) => l(presence()));
  };
  const fresh = () => setFreshness({ stale: false, syncing: false });
  const markedStaleOnFailure = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      setFreshness({ stale: true, syncing: false });
      throw e;
    }
  };

  const announce = (projectId: string, kind: string) => {
    if (kind === "agent") topic("agents").each((l) => l());
    else if (projectId !== INDEX_PROJECT_ID) projectListeners.each((l) => l(projectId));
    changeListeners.each((l) => l());
    presenceListeners.each((l) => l(presence()));
  };

  const keysOrThrow = (): RemoteKeys => {
    const keys = deps.keys();
    if (!keys) throw new KiboError("UNAUTHORIZED", "phone is not paired");
    return keys;
  };

  const open = async (projectId: string, kind: string): Promise<unknown> => {
    const opened = await store.open(keysOrThrow(), projectId, kind);
    if (opened.ok) return opened.value;
    if (opened.reason === "missing")
      throw new KiboError("REMOTE_NOT_FOUND", `no ${kind} snapshot for ${projectId}`);
    pairingListeners.each((l) => l());
    throw new KiboError("REMOTE_REJECTED", "snapshot cannot be opened with this phone key");
  };

  const reader: SnapshotReader = {
    index: async () => authenticatedJson<ProjectsIndex>(await open(INDEX_PROJECT_ID, "projects")),
    open,
    has: (projectId, kind) => store.get(projectId, kind) !== null,
    projectIds: () => store.projects().filter((id) => id !== INDEX_PROJECT_ID),
  };

  const relay = createRelay({
    api,
    keys: deps.keys,
    connectivity: () => deps.presence.get(),
    now,
    randomId: deps.randomId ?? (() => crypto.randomUUID()),
  });

  const relayWithRefusal = async (req: RpcRequest): Promise<unknown> => {
    try {
      return await relay(req);
    } catch (e) {
      const reason = isWrite(req) ? reasonOf(e, deps.presence.get()) : null;
      if (reason) refusalListeners.each((l) => l({ reason, action: actionOf(req) }));
      throw e;
    }
  };

  const warmImages = (projectId: string) =>
    images.warm(
      projectId,
      store.kinds(projectId),
      (kind) => store.get(projectId, kind),
      (kind) => open(projectId, kind),
    );

  const dispatch = async (req: RpcRequest): Promise<unknown> => {
    if (!(req.method === "componentCall" && isLocalCall(req.call))) assertRemoteAllowed(req);
    const served = await serveLocally({ reader, data: deps.data, today: () => isoDay(now()) }, req);
    if (served) {
      if (req.method === "getProject") await warmImages(req.projectId);
      return served.value;
    }
    return relayWithRefusal(req);
  };

  const isCached = (header: SnapshotHeader) => {
    const known = store.get(header.projectId, header.kind);
    return known !== null && known.header.keyEpoch === header.keyEpoch && known.header.seq >= header.seq;
  };

  const syncProject = async (projectId: string) => {
    const headers = await api.snapshotHeaders(projectId);
    const kinds = new Set(headers.map((h) => h.kind));
    for (const kind of store.kinds(projectId)) if (!kinds.has(kind)) await forget(projectId, kind);
    for (const header of headers) if (!isCached(header)) await fetchBlob(projectId, header.kind);
  };

  const forget = async (projectId: string, kind: string) => {
    await store.remove(projectId, kind);
    images.forget(projectId, kind);
  };

  const followIndex = async (full: boolean) => {
    const index = await reader.index();
    const ids = new Set(index.projects.map((p) => p.id));
    for (const id of reader.projectIds()) {
      if (ids.has(id)) continue;
      await store.removeProject(id);
      images.forget(id);
    }
    for (const id of ids) if (full || store.kinds(id).length === 0) await syncProject(id);
  };

  const fetchBlob = async (projectId: string, kind: string) => {
    const sealed = await api.snapshot(projectId, kind);
    if (sealed) await store.put(sealed);
    else await forget(projectId, kind);
  };

  return {
    rpc: async <R extends RpcRequest>(req: R) => (await dispatch(req)) as RpcResult[R["method"]],
    code: async () => {
      throw forbidden("code");
    },
    pair: async () => {
      throw forbidden("pair");
    },
    subscribe: (listener) => projectListeners.add(listener),
    subscribeTopic: (name, listener) => topic(name).add(listener),
    subscribeCode: noop,
    subscribeIntegrations: noop,
    subscribeEvents: noop,
    online: () => true,
    onConnection: (listener) => deps.presence.subscribe(listener),
    presence,
    onPresence(listener) {
      const offStore = presenceListeners.add(listener);
      const offSource = deps.presence.subscribe(() => listener(presence()));
      return () => {
        offStore();
        offSource();
      };
    },
    sync: () =>
      markedStaleOnFailure(async () => {
        await fetchBlob(INDEX_PROJECT_ID, "projects");
        if (store.get(INDEX_PROJECT_ID, "projects") !== null) await followIndex(true);
        fresh();
        announce(INDEX_PROJECT_ID, "projects");
        for (const id of reader.projectIds()) announce(id, "project");
        topic("agents").each((l) => l());
      }),
    markStale: () => setFreshness({ stale: true, syncing: true }),
    handleEvent: (event) =>
      markedStaleOnFailure(async () => {
        if (event.type === "mac.presence") return;
        if (event.type === "snapshot.removed") await forget(event.projectId, event.kind);
        else {
          const known = store.get(event.projectId, event.kind);
          if (known && known.header.seq >= event.seq && known.header.keyEpoch === deps.keys()?.epoch) return;
          await fetchBlob(event.projectId, event.kind);
          if (event.projectId === INDEX_PROJECT_ID) await followIndex(false);
        }
        fresh();
        announce(event.projectId, event.kind);
      }),
    async index() {
      if (store.get(INDEX_PROJECT_ID, "projects") === null) return null;
      return reader.index();
    },
    onChange: (listener) => changeListeners.add(listener),
    onNeedsPairing: (listener) => pairingListeners.add(listener),
    onRefused: (listener) => refusalListeners.add(listener),
    imageUrl: (projectId, questionId, imageId) => images.url(projectId, questionId, imageId),
  };
}
