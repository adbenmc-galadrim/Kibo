import type { Database } from "bun:sqlite";
import type { ChangeMessage, ProjectEventSink, T3Thread } from "@kibo/schema";
import type { RpcExtension } from "../rpc-extensions";
import { call, type Service } from "../service";
import { createT3Runner, type T3Runner } from "./t3-cli";
import { createT3Api, type T3Api, t3Rpc } from "./t3-rpc";
import { createThreadPoll } from "./thread-poll";
import { createThreadStore } from "./thread-store";

type T3Input = {
  db: Database;
  service: Service;
  clock: { now(): number };
  sink?: ProjectEventSink;
  emit(message: ChangeMessage): void;
  bin: string;
  run?: T3Runner;
};

type StartedT3 = {
  rpc: RpcExtension;
  api: T3Api;
  activity(projectId: string): ReadonlyMap<string, T3Thread>;
  stop(): void;
};

export function startT3(input: T3Input): StartedT3 {
  const store = createThreadStore(input.db);
  const run = input.run ?? createT3Runner(input.bin);
  const project = (projectId: string) => {
    const snapshot = call(input.service, { method: "getProject", projectId });
    return { folder: snapshot.meta.folder, tickets: snapshot.tickets };
  };
  const now = () => input.clock.now();
  const emit = (projectId: string) => input.emit({ projectId });
  const sink = input.sink && { sink: input.sink };
  const poll = createThreadPoll<ReturnType<typeof setInterval>>({
    store,
    run,
    folderOf: (projectId) => project(projectId).folder,
    tickets: (projectId) => project(projectId).tickets,
    now,
    emit,
    ...sink,
    log: (what, e) => console.error(`[kibo-daemon] ${what} failed`, e),
    timers: { set: (fn, ms) => setInterval(fn, ms), clear: (handle) => clearInterval(handle) },
  });
  const api = createT3Api({ bin: input.bin, run, store, poll, project, now, emit, ...sink });
  poll.start();
  return { rpc: t3Rpc(api), api, activity: store.latest, stop: poll.stop };
}
