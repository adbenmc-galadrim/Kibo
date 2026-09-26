import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { KiboError, type Worktree } from "@kibo/schema";
import { parseWorktrees } from "./parse-status";
import { createGit, type Env, type Git } from "./run";

export type WorktreeHandle = { path: string; git: Git; gitDir: string; commonDir: string; env: Env };
export type Repo = {
  root: string;
  worktrees(): Promise<Worktree[]>;
  open(path: string): Promise<WorktreeHandle>;
};

const real = (path: string): string | null => (existsSync(path) ? realpathSync(path) : null);

function assertFolder(folder: string | null): string {
  if (!folder || !statSync(folder, { throwIfNoEntry: false })?.isDirectory())
    throw new KiboError("NOT_A_REPO", `project folder ${folder ?? "(none)"} is not a directory`);
  return folder;
}

async function topLevel(folder: string, env: Env): Promise<string> {
  const top = await createGit(folder, env).run(["rev-parse", "--show-toplevel"]);
  if (top.code !== 0) throw new KiboError("NOT_A_REPO", `${folder} is not a git repository`);
  return realpathSync(top.stdout.trim());
}

async function openHandle(path: string, env: Env): Promise<WorktreeHandle> {
  const git = createGit(path, { ...env, GIT_LITERAL_PATHSPECS: "1" });
  const [gitDir = "", commonDir = ""] = (
    await git.ok(["rev-parse", "--absolute-git-dir", "--git-common-dir"])
  )
    .trim()
    .split("\n");
  return { path, git, gitDir, commonDir: resolve(path, commonDir), env };
}

export async function openRepo(folder: string | null, env: Env = {}): Promise<Repo> {
  const root = await topLevel(assertFolder(folder), env);
  const git = createGit(root, env);
  const worktrees = async () =>
    parseWorktrees(await git.ok(["worktree", "list", "--porcelain", "-z"])).map((w) => ({
      ...w,
      path: real(w.path) ?? w.path,
    }));
  return {
    root,
    worktrees,
    async open(path) {
      const wanted = real(path);
      const match = wanted ? (await worktrees()).find((w) => w.path === wanted) : undefined;
      if (!wanted || !match)
        throw new KiboError("PATH_OUTSIDE_PROJECT", `${path} is not a worktree of ${root}`);
      return openHandle(wanted, env);
    },
  };
}
