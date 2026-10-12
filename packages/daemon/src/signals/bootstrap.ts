import { readProject } from "@kibo/core";
import type { Notice } from "../agents/notifier";
import type { Docs } from "../docs";
import type { TraceService } from "../moments/trace-service";
import type { RpcExtension } from "../rpc-extensions";
import { signalRpc } from "./rpc";
import { createSignalService, type SignalService } from "./service";
import { openSignalStore } from "./store";
import { createWakeupScheduler } from "./wakeup";

export type SignalsDocs = Pick<Docs, "projectIds" | "project" | "assertWritable" | "identity" | "emit">;

export type SignalsBootInput = {
  home: string;
  docs: SignalsDocs;
  trace: Pick<TraceService, "note">;
  notify(notice: Notice): void;
  agent: () => { send(projectId: string, text: string): void };
};

export type SignalsBoot = { service: SignalService; rpc: RpcExtension; start(): void; stop(): void };

export function projectWritable(docs: Pick<Docs, "projectIds" | "assertWritable">) {
  return (projectId: string): boolean => {
    if (!docs.projectIds().includes(projectId)) return false;
    try {
      docs.assertWritable(projectId);
      return true;
    } catch {
      return false;
    }
  };
}

export function startSignals(input: SignalsBootInput): SignalsBoot {
  const { docs } = input;
  const store = openSignalStore(input.home);
  const emit = () => docs.emit({ topic: "agents" });
  const scheduler = createWakeupScheduler({
    store,
    send: (projectId, text) => input.agent().send(projectId, text),
    writable: projectWritable(docs),
  });
  const service = createSignalService({
    store,
    project: (projectId) =>
      docs.projectIds().includes(projectId) ? readProject(docs.project(projectId)) : null,
    trace: input.trace,
    wake: (projectId, kind) => scheduler.request(projectId, kind),
    notify: input.notify,
    emit,
  });
  return {
    service,
    rpc: signalRpc(
      service,
      {
        assertWritable: (projectId) => docs.assertWritable(projectId),
        viewer: (projectId) => docs.identity(projectId),
      },
      emit,
    ),
    start: () => scheduler.start(),
    stop() {
      scheduler.stop();
      store.close();
    },
  };
}
