import { DUPLICATION_LIMITS, type IndexedFile, KiboError } from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";

export type DiffFile = { path: string; status: IndexedFile["status"]; added: number; removed: number };
export type GitDiff = { files: DiffFile[]; untracked: string[] };
export type AddedLine = { line: number; text: string };

const DIFF = ["--no-optional-locks", "diff", "--no-color", "--no-ext-diff", "--relative", "-M"];
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

async function run(git: GitRunner, args: string[], cwd: string, accept: number[] = [0]): Promise<string> {
  const r = await git(args, cwd, DUPLICATION_LIMITS.gitTimeoutMs);
  if (!accept.includes(r.code))
    throw new KiboError("GIT_FAILED", `git ${args[1]} failed: ${r.stderr.trim()}`);
  return r.stdout;
}

const fields = (out: string): string[] => out.split("\0").filter((f) => f !== "");

const STATUS: Record<string, IndexedFile["status"]> = { A: "added", D: "deleted", R: "renamed", C: "added" };

function parseNameStatus(out: string): Map<string, IndexedFile["status"]> {
  const tokens = fields(out);
  const statuses = new Map<string, IndexedFile["status"]>();
  for (let i = 0; i < tokens.length; ) {
    const letter = (tokens[i] ?? "").charAt(0);
    const moved = letter === "R" || letter === "C";
    const path = tokens[moved ? i + 2 : i + 1] ?? "";
    statuses.set(path, STATUS[letter] ?? "modified");
    i += moved ? 3 : 2;
  }
  return statuses;
}

const count = (raw: string | undefined): number => (raw === undefined || raw === "-" ? 0 : Number(raw));

function parseNumstat(out: string): Map<string, { added: number; removed: number }> {
  const tokens = fields(out);
  const counts = new Map<string, { added: number; removed: number }>();
  for (let i = 0; i < tokens.length; i++) {
    const [added, removed, path] = (tokens[i] ?? "").split("\t");
    const moved = path === "";
    const target = moved ? (tokens[i + 2] ?? "") : (path ?? "");
    counts.set(target, { added: count(added), removed: count(removed) });
    if (moved) i += 2;
  }
  return counts;
}

export async function gitDiffSummary(
  git: GitRunner,
  cwd: string,
  base: string,
  paths: string[] = [],
): Promise<GitDiff> {
  const spec = ["--", ...paths];
  const names = parseNameStatus(await run(git, [...DIFF, "--name-status", "-z", base, ...spec], cwd));
  const counts = parseNumstat(await run(git, [...DIFF, "--numstat", "-z", base, ...spec], cwd));
  const others = await run(
    git,
    ["--no-optional-locks", "ls-files", "--others", "--exclude-standard", "-z", ...spec],
    cwd,
  );
  const files = [...names]
    .map(([path, status]) => ({ path, status, ...(counts.get(path) ?? { added: 0, removed: 0 }) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, untracked: fields(others).sort() };
}

export function parseAddedLines(patch: string): AddedLine[] {
  const lines: AddedLine[] = [];
  let next: number | null = null;
  for (const raw of patch.split("\n")) {
    const hunk = HUNK.exec(raw);
    if (hunk) next = Number(hunk[1]);
    else if (next !== null && raw.startsWith("+")) lines.push({ line: next++, text: raw.slice(1) });
  }
  return lines;
}

export async function addedLinesOf(
  git: GitRunner,
  cwd: string,
  base: string,
  path: string,
): Promise<AddedLine[]> {
  const tracked = await run(git, [...DIFF, "-U0", base, "--", path], cwd);
  if (tracked !== "") return parseAddedLines(tracked);
  const others = await run(
    git,
    ["--no-optional-locks", "ls-files", "--others", "--exclude-standard", "-z", "--", path],
    cwd,
  );
  if (others === "") return [];
  return parseAddedLines(
    await run(
      git,
      [
        "--no-optional-locks",
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--no-index",
        "-U0",
        "--",
        "/dev/null",
        path,
      ],
      cwd,
      [0, 1],
    ),
  );
}
