import { stat } from "node:fs/promises";
import { KiboError, maskSecrets, type Overlap, type OverlapDetail, type OverlapSide } from "@kibo/schema";
import { type PathScreen, type PeekFs, readPeekFile, resolvePeekPath } from "./peek-path";
import type { OverlapStore } from "./store";

export type OverlapReaderDeps = {
  store: Pick<OverlapStore, "get">;
  runName(runId: string): string;
  screen: PathScreen;
  fs: PeekFs;
};

export type OverlapSides = { owner: OverlapSide; other: OverlapSide };

const pathsOf = (detail: OverlapDetail): { owner: string; other: string } =>
  detail.kind === "file"
    ? { owner: detail.path, other: detail.path }
    : { owner: detail.ownerPath, other: detail.otherPath };

const isFolder = (path: string): Promise<boolean> =>
  stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  );

const refusalOf = (e: unknown, path: string): string => {
  if (!(e instanceof KiboError) || e.code !== "INVALID_INPUT") throw e;
  return e.detail.startsWith(`${path} : `) ? e.detail.slice(path.length + 3) : e.detail;
};

export function createOverlapReader(deps: OverlapReaderDeps) {
  async function side(runId: string, workspace: string, path: string): Promise<OverlapSide> {
    const base = { runId, runName: deps.runName(runId), path };
    if (!(await isFolder(workspace))) return { ...base, content: null, reason: "espace de travail disparu" };
    try {
      const content = await readPeekFile(deps.fs, resolvePeekPath(workspace, path, deps.screen), path);
      return content === null
        ? { ...base, content: null, reason: "fichier absent" }
        : { ...base, content: maskSecrets(content), reason: null };
    } catch (e) {
      return { ...base, content: null, reason: refusalOf(e, path) };
    }
  }

  return async function read(id: string): Promise<OverlapSides> {
    const overlap: Overlap | null = deps.store.get(id);
    if (!overlap) throw new KiboError("NOT_FOUND", `overlap ${id} not found`);
    const paths = pathsOf(overlap.detail);
    const [owner, other] = await Promise.all([
      side(overlap.ownerRunId, overlap.ownerWorkspace, paths.owner),
      side(overlap.otherRunId, overlap.otherWorkspace, paths.other),
    ]);
    return { owner, other };
  };
}
