import { readProject } from "@kibo/core";
import { type AnsweredLine, answerQuote, isAnswered, questionLabel } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import type { Docs } from "../docs";
import type { TraceService } from "../moments/trace-service";
import type { RpcExtension } from "../rpc-extensions";
import { signalRpc } from "./rpc";
import { createSignalService, type SignalService } from "./service";
import { openSignalStore } from "./store";
import { createWakeupScheduler } from "./wakeup";

export type SignalsDocs = Pick<
  Docs,
  "projectIds" | "project" | "assertWritable" | "identity" | "emit" | "today"
>;

export type SignalsBootInput = {
  home: string;
  docs: SignalsDocs;
  trace: Pick<TraceService, "note">;
  notify(notice: Notice): void;
  agent: () => { send(projectId: string, text: string): void };
  answerGrace?: number;
};

export type SignalsBoot = {
  service: SignalService;
  rpc: RpcExtension;
  start(): void;
  stop(): void;
  wakeOnAnswer(projectId: string, questionId: string): void;
};

export function answeredLines(docs: Pick<Docs, "project" | "today">) {
  return (projectId: string, questionIds: readonly string[]): AnsweredLine[] => {
    const questions = readProject(docs.project(projectId), docs.today()).questions;
    return questionIds.flatMap((id) => {
      const q = questions.find((candidate) => candidate.id === id);
      return q?.answer && isAnswered(q) ? [{ label: questionLabel(q), quote: answerQuote(q.answer) }] : [];
    });
  };
}

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
    answered: answeredLines(docs),
    grace: input.answerGrace,
  });
  const service = createSignalService({
    store,
    project: (projectId) =>
      docs.projectIds().includes(projectId) ? readProject(docs.project(projectId), docs.today()) : null,
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
    wakeOnAnswer(projectId, questionId) {
      try {
        scheduler.requestAnswer(projectId, questionId);
      } catch (e) {
        console.error(`[kibo-daemon] queuing the answer ${questionId} of ${projectId} failed`, e);
      }
    },
    stop() {
      scheduler.stop();
      store.close();
    },
  };
}
