import { readProject } from "@kibo/core";
import { type AnsweredLine, answerQuote, isAnswered, questionLabel } from "@kibo/schema";
import type { Docs } from "../../docs";
import { openWakeupStore } from "./store";
import { createWakeupScheduler } from "./wakeup";

export type WakeupDocs = Pick<Docs, "projectIds" | "project" | "assertWritable" | "today">;

export type WakeupBootInput = {
  home: string;
  docs: WakeupDocs;
  agent: () => { send(projectId: string, text: string): void };
  answerGrace?: number;
};

export type WakeupBoot = {
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

export function startWakeup(input: WakeupBootInput): WakeupBoot {
  const { docs } = input;
  const store = openWakeupStore(input.home);
  const scheduler = createWakeupScheduler({
    store,
    send: (projectId, text) => input.agent().send(projectId, text),
    writable: projectWritable(docs),
    answered: answeredLines(docs),
    grace: input.answerGrace,
  });
  return {
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
