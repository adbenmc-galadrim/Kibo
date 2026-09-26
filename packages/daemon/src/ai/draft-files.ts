import {
  chmodSync,
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { ComponentManifest, type DraftIncident, type GrantedPermissions, KiboError } from "@kibo/schema";
import {
  assertRealDir,
  type EntryKind,
  guarded,
  ignored,
  isRealDir,
  isSafeFile,
  listEntries,
  posix,
  present,
  removeTree,
  safeCopy,
} from "./draft-fs";

export type DraftPaths = { dir: string; baseDir: string };

type Entries = Map<string, EntryKind>;

const MANIFEST = "kibo.component.json";
const CONFORMANCE_TEST = "component.test.tsx";
const CONFORMANCE_CALL = /\brunConformance\s*\(/;
const AGENT_TEST = /^[A-Za-z0-9_-]+\.test\.tsx$/;
const KIBO_ONLY = new Set(["claude.md", ".claude"]);

export const draftPaths = (home: string, draftId: string): DraftPaths => ({
  dir: join(home, "components", "drafts", draftId),
  baseDir: join(home, "components", "drafts", `${draftId}.base`),
});

export const isAgentFile = (rel: string, allowServer: boolean): boolean =>
  !rel.includes("/") && (rel === "ui.tsx" || (allowServer && rel === "server.ts") || AGENT_TEST.test(rel));

const sameBytes = (a: string, b: string) => Buffer.compare(readFileSync(a), readFileSync(b)) === 0;

function restore(paths: DraftPaths, rel: string) {
  const target = join(paths.dir, rel);
  removeTree(target);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, readFileSync(join(paths.baseDir, rel)), { mode: 0o600, flag: "wx" });
}

function assertInside(dir: string, rel: string) {
  const inside = relative(dir, resolve(dir, rel));
  if (rel.includes("\0") || isAbsolute(rel) || inside === "" || inside.startsWith("..") || isAbsolute(inside))
    throw new KiboError("INVALID_INPUT", `Kibo file ${rel} is outside the draft`);
}

export async function prepareDraft(input: {
  paths: DraftPaths;
  fill: (dir: string) => Promise<void>;
  kiboFiles: Record<string, string>;
}): Promise<void> {
  const { dir, baseDir } = input.paths;
  for (const rel of Object.keys(input.kiboFiles)) assertInside(dir, rel);
  if (present(dir) || present(baseDir)) throw new KiboError("CONFLICT", `draft folder ${dir} already exists`);
  mkdirSync(dirname(dir), { recursive: true, mode: 0o700 });
  mkdirSync(dir, { mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
    await input.fill(dir);
    for (const [rel, text] of Object.entries(input.kiboFiles)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true, mode: 0o700 });
      writeFileSync(join(dir, rel), text, { mode: 0o600 });
    }
    cpSync(dir, baseDir, { recursive: true, filter: safeCopy(dir) });
    chmodSync(baseDir, 0o700);
  } catch (e) {
    removeDraft(input.paths);
    throw e;
  }
}

export function copySource(src: string, dir: string): void {
  cpSync(src, dir, { recursive: true, filter: safeCopy(src) });
}

function checkFiles(
  paths: DraftPaths,
  base: Entries,
  current: Entries,
  allowServer: boolean,
  out: DraftIncident[],
) {
  for (const [rel, kind] of current) {
    if (kind === "dir") continue;
    const inBase = base.get(rel) === "file";
    if (kind === "unsafe") {
      unlinkSync(join(paths.dir, rel));
      if (inBase) restore(paths, rel);
      out.push({ kind: inBase ? "restored" : "removed", path: rel });
    } else if (isAgentFile(rel, allowServer)) continue;
    else if (!inBase) {
      unlinkSync(join(paths.dir, rel));
      out.push({ kind: "removed", path: rel });
    } else if (!sameBytes(join(paths.dir, rel), join(paths.baseDir, rel))) {
      restore(paths, rel);
      out.push({ kind: "restored", path: rel });
    }
  }
}

function removeUnknownDirs(paths: DraftPaths, base: Entries, current: Entries, out: DraftIncident[]) {
  const removed: string[] = [];
  for (const [rel, kind] of current) {
    if (kind !== "dir" || base.get(rel) === "dir" || removed.some((r) => rel.startsWith(`${r}/`))) continue;
    removeTree(join(paths.dir, rel));
    removed.push(rel);
    const inBase = base.get(rel) === "file";
    if (inBase) restore(paths, rel);
    out.push({ kind: inBase ? "restored" : "removed", path: rel });
  }
}

function sanitizeBuildOutputs(dir: string, out: DraftIncident[]) {
  assertRealDir(dir);
  chmodSync(dir, 0o700);
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || !ignored(name)) continue;
    const abs = join(dir, name);
    const keep = name.endsWith(".tsbuildinfo") ? isSafeFile(abs) : isRealDir(abs);
    if (!keep) {
      removeTree(abs);
      out.push({ kind: "removed", path: name });
    } else if (isRealDir(abs))
      for (const [rel, kind] of listEntries(abs))
        if (kind === "unsafe") {
          removeTree(join(abs, rel));
          out.push({ kind: "removed", path: `${name}/${rel}` });
        }
  }
}

function restoreMissing(paths: DraftPaths, base: Entries, allowServer: boolean, out: DraftIncident[]) {
  for (const [rel, kind] of base) {
    if (kind !== "file" || isAgentFile(rel, allowServer) || present(join(paths.dir, rel))) continue;
    restore(paths, rel);
    out.push({ kind: "restored", path: rel });
  }
}

function restoreConformance(paths: DraftPaths, base: Entries, out: DraftIncident[]) {
  if (base.get(CONFORMANCE_TEST) !== "file") return;
  const test = join(paths.dir, CONFORMANCE_TEST);
  if (isSafeFile(test) && CONFORMANCE_CALL.test(readFileSync(test, "utf8"))) return;
  restore(paths, CONFORMANCE_TEST);
  if (!out.some((i) => i.path === CONFORMANCE_TEST)) out.push({ kind: "restored", path: CONFORMANCE_TEST });
}

export function verifyAndRestore(paths: DraftPaths, allowServer: boolean): DraftIncident[] {
  return guarded("verify draft", () => {
    const incidents: DraftIncident[] = [];
    assertRealDir(paths.baseDir);
    sanitizeBuildOutputs(paths.dir, incidents);
    const base = listEntries(paths.baseDir, true);
    const current = listEntries(paths.dir);
    checkFiles(paths, base, current, allowServer, incidents);
    removeUnknownDirs(paths, base, current, incidents);
    restoreMissing(paths, base, allowServer, incidents);
    restoreConformance(paths, base, incidents);
    return incidents.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  });
}

export function agentFiles(paths: DraftPaths, allowServer: boolean): string[] {
  return guarded("list agent files", () => {
    const names = new Set<string>();
    for (const root of [paths.baseDir, paths.dir])
      for (const [rel, kind] of listEntries(root, root === paths.baseDir))
        if (kind === "file" && isAgentFile(rel, allowServer)) names.add(rel);
    return [...names].sort();
  });
}

function manifestFile(dir: string): string {
  assertRealDir(dir);
  const file = join(dir, MANIFEST);
  if (present(file) && !isSafeFile(file))
    throw new KiboError("STORE_CORRUPT", `${MANIFEST} in ${dir} is not a regular file`);
  return file;
}

export function readDraftManifest(dir: string): ComponentManifest {
  return guarded("read manifest", () => {
    const file = manifestFile(dir);
    chmodSync(file, 0o600);
    return ComponentManifest.parse(JSON.parse(readFileSync(file, "utf8")));
  });
}

export function writeDraftManifest(dir: string, manifest: ComponentManifest): void {
  guarded("write manifest", () => {
    const file = manifestFile(dir);
    rmSync(file, { force: true });
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  });
}

export function writePermissions(dir: string, p: GrantedPermissions): void {
  writeDraftManifest(dir, {
    ...readDraftManifest(dir),
    reads: p.reads,
    writes: p.writes,
    data: p.data,
    net: p.net,
    mcp: p.mcp,
  });
}

const installable = (dir: string) => {
  const safe = safeCopy(dir);
  return (s: string) => {
    const top = posix(relative(dir, s)).split("/")[0] ?? "";
    return s === dir || (!KIBO_ONLY.has(top.toLowerCase()) && safe(s));
  };
};

const sibling = (srcDir: string, suffix: string) => join(dirname(srcDir), `.${basename(srcDir)}.${suffix}`);

function recoverAfterCrash(srcDir: string, backup: string, trash: string) {
  removeTree(trash);
  if (!present(backup)) return;
  removeTree(srcDir);
  renameSync(backup, srcDir);
}

export function installDraft(dir: string, srcDir: string): { commit(): void; rollback(): void } {
  return guarded("install draft", () => {
    assertRealDir(dir);
    const backup = sibling(srcDir, "kibo-backup");
    const trash = sibling(srcDir, "kibo-trash");
    recoverAfterCrash(srcDir, backup, trash);
    const hadSource = present(srcDir);
    if (hadSource) renameSync(srcDir, backup);
    const undo = () => {
      removeTree(srcDir);
      if (hadSource) renameSync(backup, srcDir);
    };
    try {
      mkdirSync(srcDir, { recursive: true, mode: 0o700 });
      cpSync(dir, srcDir, { recursive: true, filter: installable(dir) });
    } catch (e) {
      undo();
      throw e;
    }
    let settled = false;
    const once = (what: string, action: () => void) => () => {
      if (settled) return;
      settled = true;
      guarded(what, action);
    };
    const dropBackup = () => {
      if (!hadSource) return;
      renameSync(backup, trash);
      removeTree(trash);
    };
    return { commit: once("commit install", dropBackup), rollback: once("roll back install", undo) };
  });
}

export function removeDraft(paths: DraftPaths): void {
  guarded("remove draft", () => {
    removeTree(paths.dir);
    removeTree(paths.baseDir);
  });
}
