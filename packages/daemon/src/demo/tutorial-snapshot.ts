import { listQuestions, listTickets } from "@kibo/core";
import type { Docs } from "../docs";
import type { TutorialSnapshot } from "./tutorial-eval";

export type TutorialSources = { docs: Pick<Docs, "projectIds" | "project"> };

export function createTutorialSnapshot(src: TutorialSources): (projectId: string) => TutorialSnapshot | null {
  return (projectId) => {
    if (!src.docs.projectIds().includes(projectId)) return null;
    const doc = src.docs.project(projectId);
    return {
      tickets: listTickets(doc),
      questions: listQuestions(doc).map((q) => ({ id: q.id, answered: q.answer !== null })),
    };
  };
}
