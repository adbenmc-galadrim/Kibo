import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ComponentManifest, type DraftIncident, type GrantedPermissions, KiboError } from "@kibo/schema";

export type DraftPaths = { dir: string; baseDir: string };

type EntryKind = "file" | "link";

const MANIFEST = "kibo.component.json";
const CONFORMANCE_TEST = "component.test.tsx";
const CONFORMANCE_CALL = /\brunConformance\s*\(/;
const AGENT_TEST = /^[A-Za-z0-9_-]+\.test\.tsx$/;
const IGNORED_DIRS = new Set(["node_modules", "dist", ".kibo"]);
const KIBO_ONLY = new Set(["CLAUDE.md", ".claude"]);

export const draftPaths = (home: string, draftId: string): DraftPaths => ({
  dir: join(home, "components", "drafts", draftId),
  baseDir: join(home, "components", "drafts", `${draftId}.base`),
});

export const isAgentFile = (rel: string, allowServer: boolean): boolean =>
  !rel.includes("/") && (rel === "ui.tsx" || (allowServer && rel === "server.ts") || AGENT_TEST.test(rel));

const ignored = (name: string) => IGNORED_DIRS.has(name) || name.endsWith(".tsbuildinfo");
const posix = (p: string) => p.split(sep).join("/");
const present = (p: string) => lstatSync(p, { throwIfNoEntry: false }) !== undefined;
const isLink = (p: string) => lstatSync(p).isSymbolicLink();

function listEntries(root: string): Map<string, EntryKind> {
  const out = new Map<string, EntryKind>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (ignored(name)) continue;
      const abs = join(dir, name);
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) out.set(posix(relative(root, abs)), "link");
      else if (st.isDirectory()) walk(abs);
      else if (st.isFile()) out.set(posix(relative(root, abs)), "file");
    }
  };
  walk(root);
  return out;
}

const sameBytes = (a: string, b: string) => Buffer.compare(readFileSync(a), readFileSync(b)) === 0;

function restore(paths: DraftPaths, rel: string) {
  const target = join(paths.dir, rel);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, readFileSync(join(paths.baseDir, rel)), { mode: 0o600 });
}

function assertInside(dir: string, rel: string) {
  const inside = relative(dir, resolve(dir, rel));
  if (rel.includes("\0") || isAbsolute(rel) || inside === "" || inside.startsWith("..") || isAbsolute(inside))
    throw new KiboError("INVALID_INPUT", `Kibo file ${rel} is outside the draft`);
}

const keepCopied = (root: string) => (s: string) => s === root || (!ignored(basename(s)) && !isLink(s));

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
    cpSync(dir, baseDir, { recursive: true, filter: keepCopied(dir) });
    chmodSync(baseDir, 0o700);
  } catch (e) {
    removeDraft(input.paths);
    throw e;
  }
}

export function copySource(src: string, dir: string): void {
  cpSync(src, dir, { recursive: true, filter: keepCopied(src) });
}

function restoreConformance(paths: DraftPaths, base: Map<string, EntryKind>, incidents: DraftIncident[]) {
  if (base.get(CONFORMANCE_TEST) !== "file") return;
  const test = join(paths.dir, CONFORMANCE_TEST);
  if (existsSync(test) && CONFORMANCE_CALL.test(readFileSync(test, "utf8"))) return;
  restore(paths, CONFORMANCE_TEST);
  if (!incidents.some((i) => i.path === CONFORMANCE_TEST))
    incidents.push({ kind: "restored", path: CONFORMANCE_TEST });
}

export function verifyAndRestore(paths: DraftPaths, allowServer: boolean): DraftIncident[] {
  const incidents: DraftIncident[] = [];
  const base = listEntries(paths.baseDir);
  const current = listEntries(paths.dir);
  for (const [rel, kind] of current) {
    const inBase = base.get(rel) === "file";
    if (kind === "link") {
      unlinkSync(join(paths.dir, rel));
      if (inBase) restore(paths, rel);
      incidents.push({ kind: inBase ? "restored" : "removed", path: rel });
      continue;
    }
    if (isAgentFile(rel, allowServer)) continue;
    if (!inBase) {
      unlinkSync(join(paths.dir, rel));
      incidents.push({ kind: "removed", path: rel });
    } else if (!sameBytes(join(paths.dir, rel), join(paths.baseDir, rel))) {
      restore(paths, rel);
      incidents.push({ kind: "restored", path: rel });
    }
  }
  for (const [rel, kind] of base) {
    if (kind !== "file" || current.has(rel) || isAgentFile(rel, allowServer)) continue;
    restore(paths, rel);
    incidents.push({ kind: "restored", path: rel });
  }
  restoreConformance(paths, base, incidents);
  return incidents.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function agentFiles(paths: DraftPaths, allowServer: boolean): string[] {
  const names = new Set<string>();
  for (const root of [paths.baseDir, paths.dir])
    for (const [rel, kind] of listEntries(root))
      if (kind === "file" && isAgentFile(rel, allowServer)) names.add(rel);
  return [...names].sort();
}

export function readDraftManifest(dir: string): ComponentManifest {
  return ComponentManifest.parse(JSON.parse(readFileSync(join(dir, MANIFEST), "utf8")));
}

export function writeDraftManifest(dir: string, manifest: ComponentManifest): void {
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
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

const installable = (dir: string) => (s: string) => {
  if (s === dir) return true;
  const top = posix(relative(dir, s)).split("/")[0] ?? "";
  return !KIBO_ONLY.has(top) && !ignored(basename(s)) && !isLink(s);
};

export function installDraft(dir: string, srcDir: string): { commit(): void; rollback(): void } {
  const backup = present(srcDir) ? join(dirname(srcDir), `.${basename(srcDir)}.kibo-backup`) : null;
  if (backup) {
    rmSync(backup, { recursive: true, force: true });
    renameSync(srcDir, backup);
  }
  const rollback = () => {
    rmSync(srcDir, { recursive: true, force: true });
    if (backup) renameSync(backup, srcDir);
  };
  try {
    mkdirSync(srcDir, { recursive: true, mode: 0o700 });
    cpSync(dir, srcDir, { recursive: true, filter: installable(dir) });
  } catch (e) {
    rollback();
    throw e;
  }
  return {
    commit: () => {
      if (backup) rmSync(backup, { recursive: true, force: true });
    },
    rollback,
  };
}

export function removeDraft(paths: DraftPaths): void {
  rmSync(paths.dir, { recursive: true, force: true });
  rmSync(paths.baseDir, { recursive: true, force: true });
}
