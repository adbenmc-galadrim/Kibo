import { stripRemote } from "@kibo/schema";
import { createGit, type Env } from "../code/run";

export type Log = (what: string) => (e: unknown) => void;

const REFS = ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"];

const branchesOf = (stdout: string): string[] => {
  const names = stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map(stripRemote)
    .filter((name) => name !== "HEAD");
  return [...new Set(names)].sort();
};

export async function readBranches(folder: string, env: Env, log: Log): Promise<string[]> {
  try {
    const result = await createGit(folder, env).run(REFS);
    if (result.code === 0) return branchesOf(result.stdout);
    log(`cannot read branches in ${folder}`)(result.stderr.trim());
  } catch (e) {
    log(`cannot read branches in ${folder}`)(e);
  }
  return [];
}
