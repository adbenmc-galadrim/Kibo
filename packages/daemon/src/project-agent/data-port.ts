import { getKeyAllocator, listProjectDomains, readProject } from "@kibo/core";
import {
  type AgentProfile,
  type Guideline,
  KiboError,
  NoteContent,
  NoteMeta,
  NotePath,
  type ProjectSnapshot,
} from "@kibo/schema";
import { isDemoProject } from "../demo/demo-project";
import { type Docs, USER_COMMAND } from "../docs";
import { noteHashOf } from "../notes/note-hash";
import type { NotesService } from "../notes/service";
import type { ProjectSettings } from "../notes/settings";
import type { ProjectAgentDataPort } from "./types";

export type ProjectAgentDataDeps = {
  docs: Docs;
  notes: Pick<NotesService, "handle" | "info">;
  settings: Pick<ProjectSettings, "get">;
  profiles(): AgentProfile[];
  guidelines(projectId: string): Guideline[];
};

function safePath(path: string): string {
  if (!NotePath.safeParse(path).success) throw new KiboError("INVALID_INPUT", `invalid note path ${path}`);
  return path;
}

const isNotFound = (e: unknown): boolean => e instanceof KiboError && e.code === "NOT_FOUND";

function snapshotOf(docs: Docs, projectId: string): ProjectSnapshot {
  const doc = docs.project(projectId);
  return {
    ...readProject(doc),
    meta: docs.projectMeta(projectId),
    viewer: docs.identity(projectId),
    ...(getKeyAllocator(doc) === "server" && { domains: listProjectDomains(doc) }),
  };
}

function notesPort(notes: ProjectAgentDataDeps["notes"]) {
  const read = async (projectId: string, path: string): Promise<NoteContent | null> => {
    try {
      return NoteContent.parse(await notes.handle(projectId, { kind: "notes.read", path: safePath(path) }));
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  };
  return {
    async notes(projectId: string) {
      const metas = NoteMeta.array().parse(await notes.handle(projectId, { kind: "list", entity: "note" }));
      const out: { path: string; title: string; hash: string }[] = [];
      for (const meta of [...metas].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        const note = await read(projectId, meta.path);
        if (note) out.push({ path: meta.path, title: meta.title, hash: noteHashOf(note.markdown) });
      }
      return out;
    },
    readNote: async (projectId: string, path: string) => (await read(projectId, path))?.markdown ?? null,
    async writeNote(projectId: string, path: string, content: string, mode: "create" | "update") {
      if (mode === "create") {
        await notes.handle(projectId, { kind: "notes.create", path: safePath(path), markdown: content });
        return;
      }
      const current = await read(projectId, path);
      if (!current) throw new KiboError("NOT_FOUND", `note ${path} not found`);
      await notes.handle(projectId, {
        kind: "notes.write",
        path,
        markdown: content,
        expectedMtime: current.mtime,
      });
    },
  };
}

export function createProjectAgentDataPort(deps: ProjectAgentDataDeps): ProjectAgentDataPort {
  const { docs } = deps;
  return {
    project: (projectId) => snapshotOf(docs, projectId),
    projectName: (projectId) => docs.projectMeta(projectId).name,
    projectFolder: (projectId) => docs.projectMeta(projectId).folder,
    assertWritable: (projectId) => docs.assertWritable(projectId),
    viewer: (projectId) => docs.identity(projectId),
    profiles: () => deps.profiles(),
    guidelines: (projectId) => deps.guidelines(projectId),
    isDemoProject: (projectId) => isDemoProject(deps.settings, projectId),
    ...notesPort(deps.notes),
    runCommand: (projectId, command) => docs.run(projectId, command, USER_COMMAND),
  };
}
