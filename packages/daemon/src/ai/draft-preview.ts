import { chmodSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ComponentDraft, type DraftPreview, KiboError, type SandboxFile } from "@kibo/schema";
import { SANDBOX_INDEX } from "../components/sandbox-server";
import { draftPaths } from "./draft-files";
import { assertRealDir, guarded, isRealDir, isSafeFile, present, removeTree } from "./draft-fs";
import type { DraftStore } from "./draft-store";
import type { Devkit } from "./ports";

export type DraftFile = SandboxFile;
export type DraftAssets = {
  lookup(draftId: string, hash: string, file: DraftFile): Promise<Uint8Array | string | null>;
};
export type PreviewFiles = { "ui.sandbox.js": Uint8Array; "ui.css": Uint8Array };

type PreviewDeps = { store: DraftStore; home: string; devkit: Pick<Devkit, "hash" | "buildPreview"> };

const PREVIEWABLE: ReadonlySet<ComponentDraft["status"]> = new Set(["review", "permissions"]);
const BUILT_FILES = ["ui.sandbox.js", "ui.css"] as const;

export const draftPreviewPath = (draftId: string, hash: string): string =>
  `/c/drafts/${draftId}/${hash}/index.html`;

function realDir(path: string): string {
  if (!present(path)) mkdirSync(path, { mode: 0o700 });
  assertRealDir(path);
  chmodSync(path, 0o700);
  return path;
}

function readBuilt(dir: string): PreviewFiles | null {
  if (!isRealDir(dir) || !BUILT_FILES.every((f) => isSafeFile(join(dir, f)))) return null;
  return {
    "ui.sandbox.js": new Uint8Array(readFileSync(join(dir, "ui.sandbox.js"))),
    "ui.css": new Uint8Array(readFileSync(join(dir, "ui.css"))),
  };
}

function previewsDir(draftDir: string): string {
  return guarded("prepare preview", () => realDir(join(realDir(join(draftDir, ".kibo")), "preview")));
}

function writeBuilt(root: string, hash: string, files: PreviewFiles): void {
  guarded("write preview", () => {
    for (const name of readdirSync(root)) removeTree(join(root, name));
    const dir = realDir(join(root, hash));
    for (const f of BUILT_FILES) writeFileSync(join(dir, f), files[f], { mode: 0o600, flag: "wx" });
  });
}

export function createDraftPreview(deps: PreviewDeps): {
  preview(draftId: string): Promise<DraftPreview>;
  assets: DraftAssets;
} {
  const built = new Map<string, { hash: string; files: PreviewFiles }>();
  const dirOf = (draftId: string) => draftPaths(deps.home, draftId).dir;

  const isPreviewable = (draftId: string): boolean => {
    try {
      return PREVIEWABLE.has(deps.store.get(draftId).status);
    } catch (e) {
      if (e instanceof KiboError && e.code === "NOT_FOUND") return false;
      throw e;
    }
  };

  const loadOrBuild = async (draftDir: string, hash: string): Promise<PreviewFiles> => {
    const root = previewsDir(draftDir);
    const cached = guarded("read preview", () => readBuilt(join(root, hash)));
    if (cached) return cached;
    const files = await deps.devkit.buildPreview(draftDir);
    writeBuilt(previewsDir(draftDir), hash, files);
    return files;
  };

  return {
    async preview(draftId) {
      const d = deps.store.get(draftId);
      if (!PREVIEWABLE.has(d.status))
        throw new KiboError("INVALID_INPUT", `draft is ${d.status}; only a draft in review can be previewed`);
      const dir = dirOf(d.id);
      guarded("open draft", () => assertRealDir(dir));
      const hash = await deps.devkit.hash(dir);
      if (built.get(d.id)?.hash !== hash) built.set(d.id, { hash, files: await loadOrBuild(dir, hash) });
      return { hash, path: draftPreviewPath(d.id, hash) };
    },
    assets: {
      async lookup(draftId, hash, file) {
        if (!isPreviewable(draftId)) {
          built.delete(draftId);
          return null;
        }
        const entry = built.get(draftId);
        if (!entry || entry.hash !== hash) return null;
        if ((await deps.devkit.hash(dirOf(draftId))) !== hash || !isPreviewable(draftId)) return null;
        return file === "index.html" ? SANDBOX_INDEX : entry.files[file];
      },
    },
  };
}
