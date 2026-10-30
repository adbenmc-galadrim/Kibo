import type { Database } from "bun:sqlite";
import type { ProjectMeta } from "@kibo/schema";
import type { Docs } from "../docs";
import { ensureNotesTables } from "./index";
import { createNotesService, type NotesService } from "./service";
import { ensureSettingsTable } from "./settings";

export type NotesDeps = {
  db: Database;
  home: string;
  docs: Pick<Docs, "projectIds" | "emit" | "onProjectRemoved"> & {
    projectMeta(projectId: string): Pick<ProjectMeta, "id" | "key" | "folder">;
  };
};
export type StartedNotes = {
  notes: NotesService;
  notesDir(projectId: string): string;
  stop(): void;
};

const log = (projectId: string) => (e: unknown) =>
  console.error(`[kibo-daemon] notes scan failed for ${projectId}`, e);

export async function startNotes(deps: NotesDeps): Promise<StartedNotes> {
  const { docs } = deps;
  ensureSettingsTable(deps.db);
  ensureNotesTables(deps.db);
  const notes = createNotesService({
    db: deps.db,
    home: deps.home,
    project: (id) => {
      const meta = docs.projectMeta(id);
      return { id: meta.id, key: meta.key, folder: meta.folder };
    },
    onChange: (id) => docs.emit({ projectId: id }),
  });
  const offRemoved = docs.onProjectRemoved((projectId) => notes.forget(projectId));
  for (const id of docs.projectIds()) await notes.refresh(id).catch(log(id));
  return {
    notes,
    notesDir: (projectId) => notes.info(projectId).dir,
    stop() {
      offRemoved();
      notes.close();
    },
  };
}
