import {
  askedNotice,
  type Batch,
  type Question,
  type RunState,
  type RunView,
  runSubject,
} from "@kibo/schema";
import { fr } from "./fr";

export type Notice = { title: string; body: string };

export function noticeFor(previous: RunState, run: RunView): Notice | null {
  if (previous === run.state) return null;
  switch (run.state) {
    case "waiting_input":
      return { title: fr.waiting(run.label), body: runSubject(run, run.question ?? "") };
    case "done":
      return { title: fr.done(run.label), body: runSubject(run) };
    case "failed":
      return { title: fr.failed(run.label), body: runSubject(run, run.error ?? "") };
    default:
      return null;
  }
}

export function questionNotice(run: RunView, question: Question): Notice | null {
  return question.blocking ? null : askedNotice(run, question.title);
}

export function batchNotice(projectName: string, batch: Pick<Batch, "seq">): Notice {
  return { title: fr.batchTitle, body: fr.batchBody(projectName, batch.seq) };
}

export function stdoutNotifier(write: (line: string) => void): (notice: Notice) => void {
  return (notice) => write(`KIBO_NOTIFY ${JSON.stringify(notice)}\n`);
}
