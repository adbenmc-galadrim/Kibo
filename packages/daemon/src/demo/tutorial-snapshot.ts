import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listInstances, listLinks, listTickets, readRegistry } from "@kibo/core";
import type { LoroDoc } from "loro-crdt";
import type { Docs } from "../docs";
import { noteHashOf } from "./demo-project";
import { DEMO_NOTE } from "./demo-seed";
import type { TutorialRun, TutorialSnapshot } from "./tutorial-eval";

export type TutorialSources = {
  docs: Pick<Docs, "projectIds" | "project" | "workspace">;
  notesDir(projectId: string): string;
  runs(): TutorialRun[];
};

const isMissing = (e: unknown) => e instanceof Error && "code" in e && e.code === "ENOENT";

export function readNoteHash(path: string): string | null {
  try {
    return noteHashOf(readFileSync(path, "utf8"));
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export const aiComponentIds = (workspace: LoroDoc): string[] =>
  Object.entries(readRegistry(workspace))
    .filter(([, entry]) => Object.values(entry.versions).some((v) => v.origin === "ai"))
    .map(([id]) => id);

export function createTutorialSnapshot(src: TutorialSources): (projectId: string) => TutorialSnapshot | null {
  return (projectId) => {
    if (!src.docs.projectIds().includes(projectId)) return null;
    const doc = src.docs.project(projectId);
    return {
      tickets: listTickets(doc),
      links: listLinks(doc),
      instances: listInstances(doc),
      noteHash: readNoteHash(join(src.notesDir(projectId), DEMO_NOTE.path)),
      runs: src.runs().filter((r) => r.projectId === projectId),
      aiComponentIds: aiComponentIds(src.docs.workspace),
    };
  };
}
