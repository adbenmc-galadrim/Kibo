import { chmodSync, lstatSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { type ChangeArea, KiboError } from "@kibo/schema";
import { hunkPatch } from "./patch";
import { currentOperation, hasHead, MAX_FILE_BYTES, readDiff, readStatus, sha1 } from "./read";
import type { WorktreeHandle } from "./repo";
import { assertNotSymlink, resolveInWorktree } from "./safe-path";

export type HunkInput = { path: string; area: ChangeArea; index: number; header: string };

const validate = (h: WorktreeHandle, paths: string[]) => {
  for (const p of paths) resolveInWorktree(h.path, p);
};

export async function stageFiles(h: WorktreeHandle, paths: string[]): Promise<void> {
  validate(h, paths);
  await h.git.ok(["add", "-A", "--", ...paths]);
}

async function stagedRenameSources(h: WorktreeHandle, paths: string[]): Promise<string[]> {
  const fields = (await h.git.ok(["diff", "--cached", "-M", "--name-status", "-z"])).split("\0");
  const wanted = new Set(paths);
  const sources: string[] = [];
  let i = 0;
  while (i < fields.length) {
    const status = fields[i] ?? "";
    const renamed = status.startsWith("R");
    const [from = "", to = ""] = fields.slice(i + 1, i + 3);
    if (renamed && wanted.has(to) && !wanted.has(from)) sources.push(from);
    i += renamed ? 3 : 2;
  }
  return sources;
}

export async function unstageFiles(h: WorktreeHandle, paths: string[]): Promise<void> {
  validate(h, paths);
  if (!(await hasHead(h))) {
    await h.git.ok(["rm", "--cached", "-r", "-q", "--", ...paths]);
    return;
  }
  const all = [...paths, ...(await stagedRenameSources(h, paths))];
  await h.git.ok(["restore", "--staged", "--", ...all]);
}

async function inHead(h: WorktreeHandle, paths: string[]): Promise<Set<string>> {
  if (!(await hasHead(h))) return new Set();
  const out = await h.git.ok(["ls-tree", "--name-only", "-z", "HEAD", "--", ...paths]);
  return new Set(out.split("\0").filter((p) => p.length > 0));
}

async function assertDiscardable(h: WorktreeHandle, paths: string[]): Promise<void> {
  if ((await currentOperation(h)) !== null)
    throw new KiboError("GIT_BUSY", "finish or abort the current operation before discarding changes");
  const status = await readStatus(h);
  const conflicted = status.files.find((f) => f.kind === "conflicted" && paths.includes(f.path));
  if (conflicted) throw new KiboError("INVALID_INPUT", `${conflicted.path} is conflicted: resolve it first`);
}

export async function discardChanges(h: WorktreeHandle, paths: string[]): Promise<void> {
  validate(h, paths);
  await assertDiscardable(h, paths);
  const tracked = await inHead(h, paths);
  const restore = paths.filter((p) => tracked.has(p));
  const remove = paths.filter((p) => !tracked.has(p));
  if (restore.length > 0)
    await h.git.ok(["restore", "--staged", "--worktree", "--source=HEAD", "--", ...restore]);
  if (remove.length > 0) {
    await h.git.ok(["rm", "--cached", "-q", "--ignore-unmatch", "--", ...remove]);
    await h.git.ok(["clean", "-f", "-q", "--", ...remove]);
  }
}

export async function stageAll(h: WorktreeHandle): Promise<void> {
  await h.git.ok(["add", "-A"]);
}

export async function unstageAll(h: WorktreeHandle): Promise<void> {
  if (await hasHead(h)) await h.git.ok(["reset", "-q"]);
  else await h.git.ok(["rm", "--cached", "-r", "-q", "--", "."]);
}

export async function stageHunk(h: WorktreeHandle, input: HunkInput): Promise<void> {
  const diff = await readDiff(h, input.path, null, input.area);
  if (!diff.hunkStaging)
    throw new KiboError("INVALID_INPUT", `${input.path} can only be staged as a whole file`);
  const hunk = diff.hunks[input.index];
  if (!hunk || hunk.header !== input.header)
    throw new KiboError("GIT_STALE", `hunk ${input.index} of ${input.path} changed`);
  const reverse = input.area === "staged" ? ["--reverse"] : [];
  await h.git.ok(["apply", "--cached", "--whitespace=nowarn", ...reverse, "-"], {
    stdin: hunkPatch(diff, input.index),
  });
}

function replaceAtomically(abs: string, bytes: Uint8Array, mode: number): void {
  const tmp = join(dirname(abs), `.${basename(abs)}.kibo-${crypto.randomUUID()}`);
  writeFileSync(tmp, bytes, { mode, flag: "wx" });
  try {
    chmodSync(tmp, mode);
    renameSync(tmp, abs);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

export async function writeFile(
  h: WorktreeHandle,
  path: string,
  content: string,
  baseHash: string,
): Promise<{ hash: string }> {
  const abs = resolveInWorktree(h.path, path);
  const bytes = new TextEncoder().encode(content);
  if (bytes.length > MAX_FILE_BYTES)
    throw new KiboError("INVALID_INPUT", `${path} exceeds ${MAX_FILE_BYTES} bytes`);
  assertNotSymlink(abs);
  const stat = lstatSync(abs, { throwIfNoEntry: false });
  if (!stat?.isFile()) throw new KiboError("NOT_FOUND", `${path} is not a file of the worktree`);
  if (sha1(new Uint8Array(readFileSync(abs))) !== baseHash)
    throw new KiboError("FILE_CHANGED", `${path} changed on disk`);
  replaceAtomically(abs, bytes, stat.mode & 0o777);
  return { hash: sha1(bytes) };
}
