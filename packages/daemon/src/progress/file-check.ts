import type { FileCheck } from "@kibo/schema";
import type { GitRunner } from "../runs/workspace-prep";

const CHECK_MAX = 100;
const PATH_MAX = 500;

const entries = (stdout: string): string[] => stdout.split("\0").filter((path) => path.length > 0);

export async function changedFiles(git: GitRunner, cwd: string, baseHead: string): Promise<string[] | null> {
  const diff = await git(["diff", "--name-only", "-z", baseHead, "--"], cwd);
  if (diff.code !== 0) return null;
  const untracked = await git(["ls-files", "-z", "--others", "--exclude-standard", "--full-name"], cwd);
  if (untracked.code !== 0) return null;
  return [...new Set([...entries(diff.stdout), ...entries(untracked.stdout)])];
}

const normalized = (path: string): string =>
  path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^(\.\/)+/, "");

const bounded = (paths: readonly string[]): string[] =>
  paths.filter((p) => p.length <= PATH_MAX).slice(0, CHECK_MAX);

export function checkFiles(declared: readonly string[], changed: readonly string[]): FileCheck {
  const said = new Set(declared.map(normalized));
  const done = new Set(changed.map(normalized));
  return {
    undeclared: bounded([...done].filter((p) => !said.has(p))),
    unchanged: bounded([...said].filter((p) => !done.has(p))),
  };
}
