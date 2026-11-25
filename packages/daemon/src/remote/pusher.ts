import {
  INDEX_PROJECT_ID,
  type MacMessage,
  type RemoteKeys,
  SNAPSHOT_MAX_BYTES,
  type SnapshotKind,
  sealSnapshot,
} from "@kibo/remote";
import type { PushedKinds } from "./pushed-kinds";
import type { BuildResult, SnapshotBlock, SnapshotBuilder } from "./snapshot-builder";
import type { RemoteTimers } from "./timers";

const PUSH_DELAY_MS = 2_000;
const RETRY_MS = 30_000;
const IDLE_MAX_MS = 10_000;

type PusherDeps = {
  builder: SnapshotBuilder;
  keys(): RemoteKeys | null;
  send(message: MacMessage): boolean;
  projects(): readonly string[];
  pushed: PushedKinds;
  now(): number;
  log(line: string): void;
  timers: RemoteTimers;
};

export type Pusher = {
  changed(projectId: string | null): void;
  pushAll(): Promise<void>;
  pushProject(projectId: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  idle(): Promise<void>;
  lastPushAt(): number | null;
  stop(): void;
};

const decodedLength = (base64url: string) => Math.floor((base64url.length * 3) / 4);

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createPusher(deps: PusherDeps): Pusher {
  const lastSeq = new Map<string, number>();
  const pending = new Set<string>();
  let cancelTimer: (() => void) | null = null;
  let timerDueAt = 0;
  let lastPushAt: number | null = null;
  let queue: Promise<void> = Promise.resolve();

  const serial = (work: () => Promise<void>): Promise<void> => {
    const next = queue.then(work).catch((e: unknown) => {
      deps.log(`[kibo-daemon] remote push failed: ${reason(e)}`);
    });
    queue = next;
    return next;
  };

  const nextSeq = (projectId: string, kind: SnapshotKind, builtAt: number) => {
    const key = `${projectId}\u0000${kind}`;
    const previous = lastSeq.get(key);
    const seq = previous !== undefined && builtAt <= previous ? previous + 1 : builtAt;
    lastSeq.set(key, seq);
    return seq;
  };

  const sendBlock = async (keys: RemoteKeys, block: SnapshotBlock) => {
    const builtAt = deps.now();
    const header = {
      v: 1 as const,
      projectId: block.projectId,
      kind: block.kind,
      seq: nextSeq(block.projectId, block.kind, builtAt),
      builtAt,
      keyEpoch: keys.epoch,
    };
    const sealed = await sealSnapshot(keys, header, block.plaintext);
    const size = decodedLength(sealed.ciphertext);
    if (size > SNAPSHOT_MAX_BYTES) {
      deps.log(
        `[kibo-daemon] remote REMOTE_TOO_LARGE: ${block.projectId}/${block.kind} is ${size} bytes, kept the last block`,
      );
      return;
    }
    if (!deps.send({ type: "snapshot.put", sealed })) return;
    lastPushAt = builtAt;
    deps.pushed.add(block.projectId, block.kind);
  };

  const removeKind = (projectId: string, kind: SnapshotKind) => {
    if (deps.send({ type: "snapshot.remove", projectId, kind })) deps.pushed.remove(projectId, kind);
  };

  const publish = async (result: BuildResult, projectId: string) => {
    const keys = deps.keys();
    if (!keys) return;
    for (const block of result.put) await sendBlock(keys, block);
    const stale = new Set([...result.removed, ...deps.pushed.kinds(projectId)]);
    for (const kind of result.kinds) stale.delete(kind);
    for (const kind of stale) removeKind(projectId, kind);
  };

  const removeFromServer = (projectId: string) => {
    if (deps.send({ type: "project.remove", projectId })) deps.pushed.forget(projectId);
  };

  const removeDisabled = () => {
    const enabledIds = new Set([INDEX_PROJECT_ID, ...deps.projects()]);
    for (const projectId of deps.pushed.projects())
      if (!enabledIds.has(projectId)) removeFromServer(projectId);
  };

  const enabled = (projectId: string) => deps.projects().includes(projectId);

  const pushIndex = async () => publish(await deps.builder.buildIndex(deps.projects()), "_");
  const schedule = (delayMs: number) => {
    const dueAt = deps.now() + delayMs;
    if (cancelTimer && timerDueAt <= dueAt) return;
    cancelTimer?.();
    timerDueAt = dueAt;
    cancelTimer = deps.timers.after(delayMs, flushPending);
  };

  const attempt = async (label: string, work: () => Promise<void>): Promise<boolean> => {
    try {
      await work();
      return true;
    } catch (e) {
      deps.log(`[kibo-daemon] remote push of ${label} failed, retried in 30 s: ${reason(e)}`);
      schedule(RETRY_MS);
      return false;
    }
  };

  const tryIndex = () => attempt("the index", pushIndex);
  const tryOne = async (projectId: string) => {
    const pushed = await attempt(projectId, async () => {
      if (enabled(projectId)) await publish(await deps.builder.buildAll(projectId), projectId);
    });
    if (!pushed) pending.add(projectId);
  };

  function flushPending() {
    cancelTimer = null;
    const projectIds = [...pending];
    pending.clear();
    void serial(async () => {
      await tryIndex();
      for (const projectId of projectIds) await tryOne(projectId);
    });
  }

  return {
    changed: (projectId) => {
      const targets = projectId === null ? deps.projects() : [projectId];
      for (const target of targets) if (enabled(target)) pending.add(target);
      if (pending.size > 0) schedule(PUSH_DELAY_MS);
    },
    pushAll: () =>
      serial(async () => {
        deps.builder.reset();
        removeDisabled();
        await tryIndex();
        for (const projectId of deps.projects()) await tryOne(projectId);
      }),
    pushProject: (projectId) =>
      serial(async () => {
        await tryIndex();
        await tryOne(projectId);
      }),
    removeProject: (projectId) =>
      serial(async () => {
        pending.delete(projectId);
        deps.builder.forget(projectId);
        removeFromServer(projectId);
        await pushIndex();
      }),
    idle: () =>
      new Promise<void>((resolve) => {
        const cancel = deps.timers.after(IDLE_MAX_MS, resolve);
        void queue.then(() => {
          cancel();
          resolve();
        });
      }),
    lastPushAt: () => lastPushAt,
    stop: () => {
      cancelTimer?.();
      cancelTimer = null;
      pending.clear();
    },
  };
}
