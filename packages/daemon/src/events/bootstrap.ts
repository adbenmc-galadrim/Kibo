import { readProject } from "@kibo/core";
import { isInbox, type ProjectEventSink } from "@kibo/schema";
import type { CommandEvent } from "../docs";
import type { RpcExtension } from "../rpc-extensions";
import type { Service } from "../service";
import type { Store } from "../store";
import { createEventRecorder, type EventRecorder } from "./recorder";
import { projectEventsRpc } from "./rpc";
import { createEventStore, type EventStore } from "./store";

export type ProjectEventsDeps = {
  store: Store;
  service: Service;
  now: () => number;
  log?: (what: string, e: unknown) => void;
};
export type ProjectEvents = {
  store: EventStore;
  recorder: EventRecorder;
  sink: ProjectEventSink;
  rpc: RpcExtension;
  stop(): void;
};

type Collected = { token: unknown; done: CommandEvent[] };

const defaultLog = (what: string, e: unknown) => console.error(`[kibo-daemon] ${what}`, e);

export function startProjectEvents(deps: ProjectEventsDeps): ProjectEvents {
  const { docs } = deps.service;
  const log = deps.log ?? defaultLog;
  const store = createEventStore(deps.store.db, deps.now);
  const recorder = createEventRecorder({
    store,
    snapshot: (projectId) => readProject(docs.project(projectId), docs.today(), docs.activity(projectId)),
    emit: (projectId) => docs.emit({ projectId }),
    log,
  });
  const collected = new Map<string, Collected>();

  const offIntercept = deps.service.commands.intercept((projectId, command) => {
    if (!isInbox(projectId)) recorder.beforeCommand(projectId, docs.project(projectId), command.method);
    return command;
  });
  const offCommand = deps.service.commands.onCommand((e) => {
    if (isInbox(e.projectId)) return;
    const token = docs.project(e.projectId);
    const known = collected.get(e.projectId);
    if (known?.token === token) known.done.push(e);
    else collected.set(e.projectId, { token, done: [e] });
  });
  const offChange = deps.service.onChange((message) => {
    if (!("projectId" in message) || message.projectId === null) return;
    const batch = collected.get(message.projectId);
    if (!batch) return;
    collected.delete(message.projectId);
    try {
      if (docs.project(message.projectId) === batch.token)
        recorder.afterCommands(message.projectId, batch.done);
    } catch (e) {
      log(`project events not recorded for ${message.projectId}`, e);
    }
  });

  return {
    store,
    recorder,
    sink: recorder,
    rpc: projectEventsRpc({ events: store, docs }),
    stop() {
      offIntercept();
      offCommand();
      offChange();
      collected.clear();
    },
  };
}
