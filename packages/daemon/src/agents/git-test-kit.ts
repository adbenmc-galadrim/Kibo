import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGit } from "./workspace-prep";

const dirs: string[] = [];

export const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "kibo-ws-"));
  dirs.push(d);
  return d;
};

export const cleanupTmp = (): void => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
};

export const commit = [
  "-c",
  "user.email=t@kibo.test",
  "-c",
  "user.name=t",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "-q",
];

export async function git(args: string[], cwd: string): Promise<string> {
  const r = await runGit(args, cwd);
  if (r.code !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

export async function repo(initialBranch = "main", at?: string): Promise<string> {
  const d = at ?? tmp();
  mkdirSync(d, { recursive: true });
  await git(["init", "-q", "-b", initialBranch], d);
  await git([...commit, "--allow-empty", "-m", "init"], d);
  return d;
}

export async function worktree(repoDir: string, branch: string): Promise<string> {
  const path = join(tmp(), `wt-${branch}`);
  await git(["worktree", "add", "-q", "-b", branch, path, "HEAD"], repoDir);
  return realpathSync(path);
}

export async function merge(repoDir: string, branch: string): Promise<{ code: number; stdout: string }> {
  const r = await runGit([...commit.slice(0, 6), "merge", "--no-edit", branch], repoDir);
  return { code: r.code, stdout: `${r.stdout}${r.stderr}` };
}

export async function worktreeWith(
  repoDir: string,
  branch: string,
  files: Record<string, string>,
): Promise<string> {
  const path = await worktree(repoDir, branch);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(path, name), content);
  return path;
}
