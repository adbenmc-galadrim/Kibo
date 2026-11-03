import { openSnapshot, type RemoteKeys, Sealed } from "@kibo/remote";
import { KiboError } from "@kibo/schema";
import type { KeyValueStore } from "./storage";

export type Opened =
  | { ok: true; value: unknown; builtAt: number }
  | { ok: false; reason: "missing" | "needsPairing" };

export type SnapshotStore = {
  load(): Promise<void>;
  put(sealed: Sealed): Promise<boolean>;
  get(projectId: string, kind: string): Sealed | null;
  kinds(projectId: string): string[];
  projects(): string[];
  remove(projectId: string, kind: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  clear(): Promise<void>;
  lastBuiltAt(): number | null;
  open(keys: RemoteKeys, projectId: string, kind: string): Promise<Opened>;
};

const decoder = new TextDecoder();
const slotKey = (projectId: string, kind: string) => `${projectId}/${kind}`;

export function createSnapshotStore(store: KeyValueStore): SnapshotStore {
  const blobs = new Map<string, Sealed>();
  const opened = new Map<string, { sealed: Sealed; value: unknown }>();

  const forget = async (key: string) => {
    blobs.delete(key);
    opened.delete(key);
    await store.delete(key);
  };

  const decrypt = async (keys: RemoteKeys, sealed: Sealed): Promise<unknown> =>
    JSON.parse(decoder.decode(await openSnapshot(keys, sealed)));

  return {
    async load() {
      for (const key of await store.keys()) {
        const parsed = Sealed.safeParse(await store.get(key));
        if (parsed.success) blobs.set(key, parsed.data);
        else await store.delete(key);
      }
    },
    async put(sealed) {
      const key = slotKey(sealed.header.projectId, sealed.header.kind);
      const current = blobs.get(key);
      if (
        current &&
        current.header.keyEpoch === sealed.header.keyEpoch &&
        current.header.seq > sealed.header.seq
      )
        return false;
      blobs.set(key, sealed);
      opened.delete(key);
      await store.put(key, sealed);
      return true;
    },
    get: (projectId, kind) => blobs.get(slotKey(projectId, kind)) ?? null,
    kinds: (projectId) =>
      [...blobs.values()].filter((s) => s.header.projectId === projectId).map((s) => s.header.kind),
    projects: () => [...new Set([...blobs.values()].map((s) => s.header.projectId))],
    remove: (projectId, kind) => forget(slotKey(projectId, kind)),
    async removeProject(projectId) {
      for (const [key, sealed] of [...blobs]) if (sealed.header.projectId === projectId) await forget(key);
    },
    async clear() {
      blobs.clear();
      opened.clear();
      await store.clear();
    },
    lastBuiltAt() {
      const times = [...blobs.values()].map((s) => s.header.builtAt);
      return times.length === 0 ? null : Math.max(...times);
    },
    async open(keys, projectId, kind) {
      const key = slotKey(projectId, kind);
      const sealed = blobs.get(key);
      if (!sealed) return { ok: false, reason: "missing" };
      const cached = opened.get(key);
      if (cached?.sealed === sealed) return { ok: true, value: cached.value, builtAt: sealed.header.builtAt };
      try {
        const value = await decrypt(keys, sealed);
        opened.set(key, { sealed, value });
        return { ok: true, value, builtAt: sealed.header.builtAt };
      } catch (e) {
        if (e instanceof KiboError && e.code === "REMOTE_REJECTED")
          return { ok: false, reason: "needsPairing" };
        throw e;
      }
    },
  };
}
