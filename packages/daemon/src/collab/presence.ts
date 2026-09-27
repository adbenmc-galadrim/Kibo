import {
  type ChangeMessage,
  type ClientFrame,
  isTerminal,
  KiboError,
  type MemberInfo,
  type PresencePeer,
  type PresenceRun,
  type PresenceState,
  type RunView,
  type ServerFrame,
} from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { EphemeralStore } from "loro-crdt";
import { BoundedPresenceState, incomingStates } from "./presence-guard";

export type PresenceDeps = {
  send(frame: ClientFrame): void;
  identity(): { userId: string; name: string; deviceId: string } | null;
  runs(projectId: string): PresenceRun[];
  members(projectId: string): MemberInfo[];
  shared(projectId: string): boolean;
  online(): boolean;
  emit(message: ChangeMessage): void;
  log(message: string, error?: unknown): void;
  timeoutMs: number;
};

export function presenceRuns(
  runs: Pick<RunView, "projectId" | "ticketKey" | "profileName" | "state">[],
  projectId: string,
): PresenceRun[] {
  return runs
    .filter((r) => r.projectId === projectId && !isTerminal(r.state))
    .map((r) => ({ ticketKey: r.ticketKey, profile: r.profileName, state: r.state }));
}

type Where = { pageId: string | null; ticketId: string | null };
type Entry = {
  store: EphemeralStore;
  off: () => void;
  where: Where;
  published: PresenceState | null;
  publishedAt: number;
  retry: ReturnType<typeof setTimeout> | null;
};

const SAME_MILLISECOND_RETRY_MS = 2;

const codeOf = (e: unknown): string => (e instanceof KiboError ? e.code : "INTERNAL");

export class PresenceHub {
  private readonly projects = new Map<string, Entry>();

  constructor(private readonly deps: PresenceDeps) {}

  set(projectId: string, where: Where): void {
    if (!this.deps.shared(projectId)) return;
    const entry = this.entry(projectId);
    entry.where = where;
    this.publish(projectId, entry);
  }

  receive(projectId: string, bytes: Uint8Array): void {
    if (!this.deps.shared(projectId)) throw new KiboError("NOT_FOUND", `project ${projectId} is not shared`);
    const entry = this.entry(projectId);
    const incoming = incomingStates(bytes, new Set(entry.store.keys()));
    try {
      entry.store.apply(bytes);
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `unreadable presence: ${String(e)}`);
    }
    const ownKey = this.deps.identity()?.deviceId;
    const refused: string[] = [];
    for (const [key, value] of incoming) {
      if (key === ownKey) continue;
      const parsed = BoundedPresenceState.safeParse(value);
      if (parsed.success) entry.store.set(key, parsed.data);
      else {
        entry.store.delete(key);
        refused.push(key);
      }
    }
    if (ownKey !== undefined && (incoming.has(ownKey) || entry.store.get(ownKey) === undefined)) {
      this.restoreOwn(entry, ownKey);
    }
    if (refused.length > 0) {
      throw new KiboError("INVALID_INPUT", `presence refused for ${refused.length} device(s)`);
    }
  }

  peers(projectId: string): PresencePeer[] {
    const entry = this.projects.get(projectId);
    const me = this.deps.identity();
    if (!entry || !me || !this.deps.shared(projectId)) return [];
    const names = new Map(this.deps.members(projectId).map((m) => [m.userId, m.name]));
    const peers: PresencePeer[] = [];
    for (const [deviceId, value] of Object.entries(entry.store.getAllStates())) {
      const parsed = BoundedPresenceState.safeParse(value);
      if (!parsed.success) continue;
      const self = deviceId === me.deviceId;
      const name = self ? me.name : names.get(parsed.data.userId);
      if (name === undefined) continue;
      peers.push({ ...parsed.data, name, deviceId, self });
    }
    return peers.sort((a, b) => a.name.localeCompare(b.name));
  }

  refreshRuns(): void {
    for (const [projectId, entry] of this.projects) this.safePublish(projectId, entry);
  }

  tick(): void {
    for (const [projectId, entry] of [...this.projects]) {
      if (!this.deps.shared(projectId)) {
        this.forget(projectId);
        continue;
      }
      this.safePublish(projectId, entry);
      this.deps.emit({ type: "presence.changed", projectId });
    }
  }

  forget(projectId: string): void {
    const entry = this.projects.get(projectId);
    if (!entry) return;
    entry.off();
    if (entry.retry) clearTimeout(entry.retry);
    entry.store.destroy();
    this.projects.delete(projectId);
    this.deps.emit({ type: "presence.changed", projectId });
  }

  dispose(): void {
    for (const id of [...this.projects.keys()]) this.forget(id);
  }

  private entry(projectId: string): Entry {
    const existing = this.projects.get(projectId);
    if (existing) return existing;
    const store = new EphemeralStore(this.deps.timeoutMs);
    const off = store.subscribe(() => this.deps.emit({ type: "presence.changed", projectId }));
    const entry: Entry = {
      store,
      off,
      where: { pageId: null, ticketId: null },
      published: null,
      publishedAt: 0,
      retry: null,
    };
    this.projects.set(projectId, entry);
    return entry;
  }

  private restoreOwn(entry: Entry, ownKey: string): void {
    if (entry.published) entry.store.set(ownKey, entry.published);
    else if (entry.store.get(ownKey) !== undefined) entry.store.delete(ownKey);
  }

  private safePublish(projectId: string, entry: Entry): void {
    try {
      this.publish(projectId, entry);
    } catch (e) {
      this.deps.log(`presence of ${projectId} not published (${codeOf(e)})`, e);
    }
  }

  private publishLater(projectId: string, entry: Entry): void {
    if (entry.retry) return;
    entry.retry = setTimeout(() => {
      entry.retry = null;
      this.safePublish(projectId, entry);
    }, SAME_MILLISECOND_RETRY_MS);
  }

  private publish(projectId: string, entry: Entry): void {
    if (!this.deps.shared(projectId)) {
      this.forget(projectId);
      return;
    }
    const me = this.deps.identity();
    if (!me) return;
    const now = Date.now();
    if (now < entry.publishedAt) entry.publishedAt = now - 1;
    // loro-crdt EphemeralStore drops an update whose timestamp equals the previous one.
    if (now === entry.publishedAt) {
      this.publishLater(projectId, entry);
      return;
    }
    const parsed = BoundedPresenceState.safeParse({
      userId: me.userId,
      name: me.name,
      pageId: entry.where.pageId,
      ticketId: entry.where.ticketId,
      runs: this.deps.runs(projectId).slice(0, 50),
    });
    if (!parsed.success)
      throw new KiboError("INVALID_INPUT", `own presence is invalid: ${parsed.error.message}`);
    entry.published = parsed.data;
    entry.publishedAt = now;
    entry.store.set(me.deviceId, parsed.data);
    if (!this.deps.online()) return;
    this.deps.send({ type: "presence", projectId, bytes: toBase64(entry.store.encode(me.deviceId)) });
  }
}

export function routePresenceFrames(
  client: { onFrame(listener: (frame: ServerFrame) => void): () => void },
  hub: PresenceHub,
  log: (message: string, error?: unknown) => void,
): () => void {
  return client.onFrame((f) => {
    try {
      if (f.type === "presence") hub.receive(f.projectId, fromBase64(f.bytes));
      else if (f.type === "welcome") hub.tick();
      else if (f.type === "revoked") hub.forget(f.projectId);
    } catch (e) {
      log(`presence frame ${f.type} refused (${codeOf(e)})`, e);
    }
  });
}
