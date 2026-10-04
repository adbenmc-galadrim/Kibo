import { chmodSync, constants, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import {
  type ComponentDraft,
  ComponentManifest,
  type DraftPreview,
  KiboError,
  type SandboxFile,
} from "@kibo/schema";
import { SANDBOX_INDEX } from "../components/sandbox-server";
import { draftPaths } from "./draft-files";
import { assertRealDir, guarded, isRealDir, isSafeFile, present, removeTree } from "./draft-fs";
import type { DraftStore } from "./draft-store";
import type { Devkit } from "./ports";

export type DraftFile = SandboxFile;
export type DraftAssets = {
  manifest(draftId: string): Promise<ComponentManifest | null>;
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

const previewsPath = (draftDir: string) => join(draftDir, ".kibo", "preview");

function readBuilt(draftDir: string, hash: string): PreviewFiles | null {
  const root = previewsPath(draftDir);
  const dir = join(root, hash);
  if (![join(draftDir, ".kibo"), root, dir].every(isRealDir)) return null;
  if (!BUILT_FILES.every((f) => isSafeFile(join(dir, f)))) return null;
  return {
    "ui.sandbox.js": new Uint8Array(readFileSync(join(dir, "ui.sandbox.js"))),
    "ui.css": new Uint8Array(readFileSync(join(dir, "ui.css"))),
  };
}

function writeBuilt(draftDir: string, hash: string, files: PreviewFiles): void {
  guarded("write preview", () => {
    const root = realDir(join(realDir(join(draftDir, ".kibo")), "preview"));
    for (const name of readdirSync(root)) removeTree(join(root, name));
    const dir = realDir(join(root, hash));
    for (const f of BUILT_FILES) writeFileSync(join(dir, f), files[f], { mode: 0o600, flag: "wx" });
  });
}

const MANIFEST = "kibo.component.json";
const MAX_MANIFEST_BYTES = 256 * 1024;
const NO_FOLLOW = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const UNREADABLE = new Set(["ENOENT", "ELOOP", "ENOTDIR"]);

async function readManifestText(dir: string): Promise<string | null> {
  let file: Awaited<ReturnType<typeof open>>;
  try {
    file = await open(join(dir, MANIFEST), NO_FOLLOW);
  } catch (e) {
    if (e instanceof Error && "code" in e && UNREADABLE.has(String(e.code))) return null;
    throw e;
  }
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > MAX_MANIFEST_BYTES) return null;
    return await file.readFile("utf8");
  } finally {
    await file.close();
  }
}

function parseManifest(text: string): ComponentManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
  const parsed = ComponentManifest.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const changed = () => new KiboError("CONFLICT", "the draft changed while its preview was built");

const stampOf = (d: ComponentDraft): string | null =>
  PREVIEWABLE.has(d.status) ? JSON.stringify([d.status, d.runId, d.attempts, d.revisions]) : null;

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

  const stamp = (draftId: string): string | null => {
    try {
      return stampOf(deps.store.get(draftId));
    } catch (e) {
      if (e instanceof KiboError && e.code === "NOT_FOUND") return null;
      throw e;
    }
  };

  const assertUnchanged = async (draftId: string, before: string, hash: string): Promise<void> => {
    const dir = dirOf(draftId);
    if (stamp(draftId) !== before || !isRealDir(dir)) throw changed();
    const now = await deps.devkit.hash(dir).catch((e: unknown) => {
      if (!(e instanceof KiboError) && !isRealDir(dir)) throw changed();
      throw e;
    });
    if (now !== hash || stamp(draftId) !== before) throw changed();
  };

  const build = async (draftId: string, before: string): Promise<PreviewFiles> => {
    const dir = dirOf(draftId);
    try {
      return await deps.devkit.buildPreview(dir);
    } catch (e) {
      if (!(e instanceof KiboError) && (stamp(draftId) !== before || !isRealDir(dir))) throw changed();
      throw e;
    }
  };

  const loadOrBuild = async (draftId: string, before: string, hash: string): Promise<PreviewFiles> => {
    const dir = dirOf(draftId);
    const cached = guarded("read preview", () => readBuilt(dir, hash));
    if (cached) return cached;
    const files = await build(draftId, before);
    await assertUnchanged(draftId, before, hash);
    writeBuilt(dir, hash, files);
    return files;
  };

  return {
    async preview(draftId) {
      const d = deps.store.get(draftId);
      const before = stampOf(d);
      if (before === null)
        throw new KiboError("INVALID_INPUT", `draft is ${d.status}; only a draft in review can be previewed`);
      const dir = dirOf(d.id);
      guarded("open draft", () => assertRealDir(dir));
      const hash = await deps.devkit.hash(dir);
      if (built.get(d.id)?.hash !== hash) {
        const files = await loadOrBuild(d.id, before, hash);
        await assertUnchanged(d.id, before, hash);
        built.set(d.id, { hash, files });
      }
      return { hash, path: draftPreviewPath(d.id, hash) };
    },
    assets: {
      async manifest(draftId) {
        if (!isPreviewable(draftId) || !isRealDir(dirOf(draftId))) return null;
        const text = await readManifestText(dirOf(draftId));
        return text === null ? null : parseManifest(text);
      },
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
