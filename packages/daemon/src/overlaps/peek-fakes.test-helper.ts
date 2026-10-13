import { stat } from "node:fs/promises";
import type { IndexedFile, Overlap, RunView, Step, WorkspaceIndex } from "@kibo/schema";
import { runGit } from "../agents/workspace-prep";
import { runView } from "../questions/questions.test-helper";
import type { PathScreen, PeekFs } from "./peek-path";
import type { PeekServices } from "./work-view";
import type { WorkspaceRef } from "./workspace";

export const NOW = 10 * 86_400_000;
export const HOUR = 3_600_000;

export const localPeekFs: PeekFs = {
  async stat(path) {
    const s = await stat(path).catch(() => null);
    return s === null ? null : { size: s.size, mtimeMs: s.mtimeMs };
  },
  async read(path, max) {
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    return Buffer.from(await file.slice(0, max).arrayBuffer());
  },
};

export const screenOf =
  (table: Record<string, "secret" | "ignored"> = {}): PathScreen =>
  (path) =>
    table[path] ?? null;

export const indexedFile = (path: string, over: Partial<IndexedFile> = {}): IndexedFile => ({
  path,
  status: "added",
  added: 10,
  removed: 0,
  hash: null,
  exports: [],
  imports: [],
  lines: [],
  clipped: false,
  ...over,
});

export const workspaceIndex = (
  key: string,
  files: IndexedFile[],
  over: Partial<WorkspaceIndex> = {},
): WorkspaceIndex => ({
  key,
  runIds: [],
  baseHead: "base",
  files,
  truncated: false,
  partial: false,
  at: NOW,
  ...over,
});

export const ticketRun = (id: string, key: string, over: Partial<RunView> = {}): RunView =>
  runView({
    id,
    projectId: "P",
    ticketId: `t-${key}`,
    ticketKey: key,
    ticketTitle: `Ticket ${key}`,
    state: "running",
    workspace: `worktree:feat/${key.toLowerCase()}`,
    cwd: `/w/${key.toLowerCase()}`,
    createdAt: NOW - HOUR,
    startedAt: NOW - HOUR,
    ...over,
  });

export const worktree = (key: string, baseHead = "base"): WorkspaceRef => ({
  key,
  kind: "worktree",
  worktreeName: key.split("/").at(-1) ?? null,
  baseHead,
});

export type FakeWorld = {
  runs: RunView[];
  spaces?: Record<string, WorkspaceRef | null>;
  indexes?: Record<string, WorkspaceIndex | null>;
  plans?: Record<string, Step[]>;
  overlaps?: Overlap[];
  screen?: (projectId: string) => PathScreen;
};

export function fakeServices(world: FakeWorld): PeekServices & { indexed: string[][] } {
  const indexed: string[][] = [];
  return {
    indexed,
    runs: () => world.runs,
    workspaceOf: async (run) => world.spaces?.[run.id] ?? null,
    async indexOf(ws, runIds) {
      indexed.push(runIds);
      return world.indexes?.[ws.key] ?? null;
    },
    planOf: (_projectId, ticketId) => world.plans?.[ticketId] ?? null,
    overlapsBetween: (a, b) =>
      (world.overlaps ?? []).filter(
        (o) => (o.ownerRunId === a && o.otherRunId === b) || (o.ownerRunId === b && o.otherRunId === a),
      ),
    runName: (run) => `bou · livraison · ${run.ticketKey}`,
    screen: world.screen ?? (() => screenOf()),
    git: runGit,
    fs: localPeekFs,
    now: () => NOW,
  };
}
