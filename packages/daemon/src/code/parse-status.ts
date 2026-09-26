import type { ChangeKind, Worktree } from "@kibo/schema";

export type StatusEntry = {
  path: string;
  origPath: string | null;
  staged: ChangeKind | null;
  unstaged: ChangeKind | null;
};
export type ParsedStatus = {
  head: string | null;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  entries: StatusEntry[];
};
export type LineCounts = { additions: number | null; deletions: number | null };

const KIND: Record<string, ChangeKind> = {
  M: "modified",
  T: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "added",
};

const kindOf = (code: string | undefined): ChangeKind | null => (code ? (KIND[code] ?? null) : null);

function afterFields(record: string, count: number): string {
  let index = 0;
  for (let i = 0; i < count; i++) index = record.indexOf(" ", index) + 1;
  return record.slice(index);
}

function readHeader(out: ParsedStatus, record: string): void {
  const [key = "", value = ""] = afterFields(record, 1).split(/ (.*)/s);
  if (key === "branch.oid") out.head = value === "(initial)" ? null : value;
  if (key === "branch.head") out.branch = value === "(detached)" ? null : value;
  if (key === "branch.upstream") out.upstream = value;
  if (key === "branch.ab") {
    const m = /^\+(\d+) -(\d+)$/.exec(value);
    out.ahead = Number(m?.[1] ?? 0);
    out.behind = Number(m?.[2] ?? 0);
  }
}

function entry(path: string, origPath: string | null, xy: string): StatusEntry {
  return { path, origPath, staged: kindOf(xy[0]), unstaged: kindOf(xy[1]) };
}

export function parseStatus(raw: string): ParsedStatus {
  const out: ParsedStatus = { head: null, branch: null, upstream: null, ahead: 0, behind: 0, entries: [] };
  const records = raw.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i] ?? "";
    const xy = record.slice(2, 4);
    if (record.startsWith("# ")) readHeader(out, record);
    else if (record.startsWith("1 ")) out.entries.push(entry(afterFields(record, 8), null, xy));
    else if (record.startsWith("2 ")) {
      i += 1;
      out.entries.push(entry(afterFields(record, 9), records[i] ?? null, xy));
    } else if (record.startsWith("u "))
      out.entries.push({
        path: afterFields(record, 10),
        origPath: null,
        staged: null,
        unstaged: "conflicted",
      });
    else if (record.startsWith("? "))
      out.entries.push({ path: record.slice(2), origPath: null, staged: null, unstaged: "untracked" });
  }
  return out;
}

const count = (value: string | undefined): number | null =>
  value === undefined || value === "-" ? null : Number(value);

export function parseNumstat(raw: string): Map<string, LineCounts> {
  const out = new Map<string, LineCounts>();
  const records = raw.split("\0");
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    const [added, deleted] = record.split("\t", 2);
    const path = afterTabs(record, 2);
    const counts = { additions: count(added), deletions: count(deleted) };
    if (path) {
      out.set(path, counts);
      continue;
    }
    i += 2;
    const target = records[i];
    if (target) out.set(target, counts);
  }
  return out;
}

function afterTabs(record: string, tabs: number): string {
  let index = 0;
  for (let i = 0; i < tabs; i++) index = record.indexOf("\t", index) + 1;
  return record.slice(index);
}

type WorktreeDraft = { path: string; head: string | null; branch: string | null; bare: boolean };

function readWorktreeLine(current: WorktreeDraft, record: string): void {
  if (record.startsWith("HEAD ")) {
    const head = record.slice(5);
    current.head = /^0+$/.test(head) ? null : head;
  } else if (record.startsWith("branch ")) current.branch = record.slice(7).replace(/^refs\/heads\//, "");
  else if (record === "bare") current.bare = true;
}

export function parseWorktrees(raw: string): Worktree[] {
  const drafts: WorktreeDraft[] = [];
  for (const record of raw.split("\0")) {
    if (record.startsWith("worktree "))
      drafts.push({ path: record.slice(9), head: null, branch: null, bare: false });
    else {
      const current = drafts.at(-1);
      if (current) readWorktreeLine(current, record);
    }
  }
  return drafts
    .filter((d) => !d.bare)
    .map((d, index) => ({ path: d.path, head: d.head, branch: d.branch, isMain: index === 0 }));
}
