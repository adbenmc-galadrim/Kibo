import {
  type MacMessage,
  type RemoteKeys,
  SNAPSHOT_MAX_BYTES,
  type SnapshotKind,
  sealSnapshot,
} from "@kibo/remote";
import type { BuildResult, SnapshotBlock, SnapshotBuilder } from "./snapshot-builder";
import type { RemoteTimers } from "./timers";

const PUSH_DELAY_MS = 2_000;

type PusherDeps = {
  builder: SnapshotBuilder;
  keys(): RemoteKeys | null;
  send(message: MacMessage): boolean;
  projects(): readonly string[];
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

export function createPusher(deps: PusherDeps): Pusher {
  const lastSeq = new Map<string, number>();
  const pending = new Set<string>();
  let cancelTimer: (() => void) | null = null;
  let lastPushAt: number | null = null;
  let queue: Promise<void> = Promise.resolve();

  const serial = (work: () => Promise<void>): Promise<void> => {
    const next = queue.then(work).catch((e: unknown) => {
      deps.log(`[kibo-daemon] remote push failed: ${e instanceof Error ? e.message : String(e)}`);
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
    if (deps.send({ type: "snapshot.put", sealed })) lastPushAt = builtAt;
  };

  const publish = async (result: BuildResult, projectId: string) => {
    const keys = deps.keys();
    if (!keys) return;
    for (const block of result.put) await sendBlock(keys, block);
    for (const kind of result.removed) deps.send({ type: "snapshot.remove", projectId, kind });
  };

  const enabled = (projectId: string) => deps.projects().includes(projectId);

  const pushIndex = async () => publish(await deps.builder.buildIndex(deps.projects()), "_");
  const pushOne = async (projectId: string) => {
    if (enabled(projectId)) await publish(await deps.builder.buildAll(projectId), projectId);
  };

  const flushPending = () => {
    cancelTimer = null;
    const projectIds = [...pending];
    pending.clear();
    void serial(async () => {
      await pushIndex();
      for (const projectId of projectIds) await pushOne(projectId);
    });
  };

  return {
    changed: (projectId) => {
      const targets = projectId === null ? deps.projects() : [projectId];
      for (const target of targets) if (enabled(target)) pending.add(target);
      if (pending.size > 0 && !cancelTimer) cancelTimer = deps.timers.after(PUSH_DELAY_MS, flushPending);
    },
    pushAll: () =>
      serial(async () => {
        deps.builder.reset();
        await pushIndex();
        for (const projectId of deps.projects()) await pushOne(projectId);
      }),
    pushProject: (projectId) =>
      serial(async () => {
        await pushIndex();
        await pushOne(projectId);
      }),
    removeProject: (projectId) =>
      serial(async () => {
        pending.delete(projectId);
        deps.builder.forget(projectId);
        deps.send({ type: "project.remove", projectId });
        await pushIndex();
      }),
    idle: () => queue,
    lastPushAt: () => lastPushAt,
    stop: () => {
      cancelTimer?.();
      cancelTimer = null;
      pending.clear();
    },
  };
}
