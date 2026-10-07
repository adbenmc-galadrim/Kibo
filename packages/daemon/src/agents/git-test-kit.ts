import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
