import { describe, expect, test } from "bun:test";
import { parseDiff } from "./parse-diff";
import { LOG_FORMAT, parseLog } from "./parse-log";
import { parseNumstat, parseStatus, parseWorktrees } from "./parse-status";

const TRICKY_NAMES = [
  "plain.ts",
  "with space.ts",
  "  leading and trailing  ",
  'quote"inside.ts',
  "back\\slash.ts",
  "tab\tinside.ts",
  "new\nline.ts",
  "été/日本語 🚀.ts",
  "# looks like a header",
  "1 M. looks like a record",
  "-> arrow.ts",
];

describe("parseStatus", () => {
  test("branch headers, ordinary, renamed, unmerged and untracked entries", () => {
    const raw = [
      "# branch.oid 1111111111111111111111111111111111111111",
      "# branch.head kib-12",
      "# branch.upstream origin/kib-12",
      "# branch.ab +2 -1",
      "1 M. N... 100644 100644 100644 aaa bbb packages/core/ticket.ts",
      "1 .M N... 100644 100644 100644 aaa aaa packages/core/index.ts",
      "1 MM N... 100644 100644 100644 aaa bbb both.ts",
      "1 .D N... 100644 100644 000000 aaa aaa packages/core/legacy-tree.ts",
      "1 A. N... 000000 100644 100644 000 bbb added.ts",
      "2 R. N... 100644 100644 100644 aaa aaa R100 new name.ts",
      "old name.ts",
      "u UU N... 100644 100644 100644 100644 a b c conflict.ts",
      "? packages/core/tree.ts",
      "! ignored.log",
      "",
    ].join("\0");
    const s = parseStatus(raw);
    expect([s.head, s.branch, s.upstream, s.ahead, s.behind]).toEqual([
      "1111111111111111111111111111111111111111",
      "kib-12",
      "origin/kib-12",
      2,
      1,
    ]);
    expect(s.entries).toEqual([
      { path: "packages/core/ticket.ts", origPath: null, staged: "modified", unstaged: null },
      { path: "packages/core/index.ts", origPath: null, staged: null, unstaged: "modified" },
      { path: "both.ts", origPath: null, staged: "modified", unstaged: "modified" },
      { path: "packages/core/legacy-tree.ts", origPath: null, staged: null, unstaged: "deleted" },
      { path: "added.ts", origPath: null, staged: "added", unstaged: null },
      { path: "new name.ts", origPath: "old name.ts", staged: "renamed", unstaged: null },
      { path: "conflict.ts", origPath: null, staged: null, unstaged: "conflicted" },
      { path: "packages/core/tree.ts", origPath: null, staged: null, unstaged: "untracked" },
    ]);
  });

  test("initial commit, detached head and missing upstream", () => {
    const initial = parseStatus("# branch.oid (initial)\0# branch.head main\0");
    expect([initial.head, initial.branch, initial.upstream, initial.ahead, initial.behind]).toEqual([
      null,
      "main",
      null,
      0,
      0,
    ]);
    expect(parseStatus("# branch.oid abc\0# branch.head (detached)\0").branch).toBeNull();
    expect(parseStatus("").entries).toEqual([]);
  });

  test("keeps every tricky file name intact", () => {
    for (const name of TRICKY_NAMES) {
      const raw = [
        `1 .M N... 100644 100644 100644 aaa aaa ${name}`,
        `2 R. N... 100644 100644 100644 aaa aaa R90 ${name}`,
        name,
        `u AA N... 000000 100644 100644 100644 0 b c ${name}`,
        `? ${name}`,
        "",
      ].join("\0");
      expect(parseStatus(raw).entries.map((e) => [e.path, e.origPath])).toEqual([
        [name, null],
        [name, name],
        [name, null],
        [name, null],
      ]);
    }
  });
});

describe("parseNumstat", () => {
  test("handles binaries and renames", () => {
    const raw = "42\t8\tpackages/core/ticket.ts\0-\t-\tlogo.png\0" + "3\t1\t\0old.ts\0new.ts\0";
    const counts = parseNumstat(raw);
    expect(counts.get("packages/core/ticket.ts")).toEqual({ additions: 42, deletions: 8 });
    expect(counts.get("logo.png")).toEqual({ additions: null, deletions: null });
    expect(counts.get("new.ts")).toEqual({ additions: 3, deletions: 1 });
    expect(counts.has("old.ts")).toBe(false);
  });

  test("keeps every tricky file name intact", () => {
    for (const name of TRICKY_NAMES) {
      const counts = parseNumstat(`1\t2\t${name}\0` + `0\t0\t\0${name}.old\0${name}.new\0`);
      expect([...counts.entries()]).toEqual([
        [name, { additions: 1, deletions: 2 }],
        [`${name}.new`, { additions: 0, deletions: 0 }],
      ]);
    }
  });
});

describe("parseWorktrees", () => {
  test("marks the first as main and skips bare entries", () => {
    const raw = [
      "worktree /repo",
      "HEAD 1111111111111111111111111111111111111111",
      "branch refs/heads/main",
      "",
      "worktree /wt/kib 12 é",
      "HEAD 2222222222222222222222222222222222222222",
      "branch refs/heads/kib-12",
      "locked agent run",
      "",
      "worktree /wt/detached",
      "HEAD 3333333333333333333333333333333333333333",
      "detached",
      "prunable gitdir file points to non-existent location",
      "",
      "worktree /wt/unborn",
      "HEAD 0000000000000000000000000000000000000000",
      "branch refs/heads/feat/unborn",
      "",
      "",
    ].join("\0");
    expect(parseWorktrees(raw)).toEqual([
      { path: "/repo", head: "1111111111111111111111111111111111111111", branch: "main", isMain: true },
      {
        path: "/wt/kib 12 é",
        head: "2222222222222222222222222222222222222222",
        branch: "kib-12",
        isMain: false,
      },
      { path: "/wt/detached", head: "3333333333333333333333333333333333333333", branch: null, isMain: false },
      { path: "/wt/unborn", head: null, branch: "feat/unborn", isMain: false },
    ]);
    expect(parseWorktrees("worktree /bare\0bare\0\0")).toEqual([]);
    expect(parseWorktrees("")).toEqual([]);
  });
});

const DIFF = [
  "diff --git a/src/ticket.ts b/src/ticket.ts",
  "index 1111111..2222222 100644",
  "--- a/src/ticket.ts",
  "+++ b/src/ticket.ts",
  "@@ -38,3 +38,4 @@ export const TicketSchema",
  " export const TicketSchema = z.object({",
  "-  parentId: z.string().nullable(),",
  "+  key: z.string(),",
  "+  statusId: z.string(),",
  " });",
  "@@ -50 +51 @@ export function toIndexRow",
  "-  return 1",
  "\\ No newline at end of file",
  "+  return 2",
  "\\ No newline at end of file",
  "",
].join("\n");

describe("parseDiff", () => {
  test("hunks, line numbers, counts and missing final newline", () => {
    const d = parseDiff(DIFF, "src/ticket.ts", null);
    expect([d.path, d.origPath, d.binary, d.hunkStaging, d.additions, d.deletions]).toEqual([
      "src/ticket.ts",
      null,
      false,
      true,
      3,
      2,
    ]);
    expect(d.hunks).toHaveLength(2);
    const [first, second] = d.hunks;
    expect([first?.oldStart, first?.oldLines, first?.newStart, first?.newLines, first?.section]).toEqual([
      38,
      3,
      38,
      4,
      "export const TicketSchema",
    ]);
    expect(first?.lines.map((l) => [l.kind, l.oldNo, l.newNo])).toEqual([
      ["context", 38, 38],
      ["del", 39, null],
      ["add", null, 39],
      ["add", null, 40],
      ["context", 40, 41],
    ]);
    expect([second?.oldLines, second?.newLines]).toEqual([1, 1]);
    expect(second?.lines.map((l) => l.noEol)).toEqual([true, true]);
  });

  test("lines that look like headers inside a hunk stay content", () => {
    const raw = "diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1,2 +1,2 @@\n---- a/x\n++++ b/x\n \n";
    const d = parseDiff(raw, "f", null);
    expect(d.hunks[0]?.lines.map((l) => [l.kind, l.text])).toEqual([
      ["del", "--- a/x"],
      ["add", "+++ b/x"],
      ["context", ""],
    ]);
  });

  test("binary, new, deleted and renamed files disable hunk staging", () => {
    const binary = parseDiff(
      "diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ\n",
      "x.png",
      null,
    );
    expect([binary.binary, binary.hunkStaging, binary.hunks]).toEqual([true, false, []]);
    const created = parseDiff(
      "diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1 @@\n+x\n",
      "n",
      null,
    );
    expect([created.hunkStaging, created.additions]).toEqual([false, 1]);
    const deleted = parseDiff("diff --git a/d b/d\ndeleted file mode 100644\n@@ -1 +0,0 @@\n-x\n", "d", null);
    expect([deleted.hunkStaging, deleted.deletions]).toEqual([false, 1]);
    const renamed = parseDiff(
      "diff --git a/o b/n\nsimilarity index 90%\nrename from o\nrename to n\n",
      "n",
      "o",
    );
    expect([renamed.hunkStaging, renamed.origPath]).toEqual([false, "o"]);
  });
});

describe("parseLog", () => {
  test("reads the NUL separated format", () => {
    expect(LOG_FORMAT).toBe("%H%x00%h%x00%s%x00%b%x00%an%x00%at%x1e");
    const raw = `${"a".repeat(40)}\0aaaaaaa\0feat: x\0- body\n\0Adam\x001700000000\x1e\n${"b".repeat(40)}\0bbbbbbb\0chore: y\0\0Adam\x001690000000\x1e\n`;
    const commits = parseLog(raw, (sha) => sha.startsWith("b"));
    expect(commits).toEqual([
      {
        sha: "a".repeat(40),
        shortSha: "aaaaaaa",
        subject: "feat: x",
        body: "- body",
        author: "Adam",
        time: 1_700_000_000_000,
        pushed: false,
      },
      {
        sha: "b".repeat(40),
        shortSha: "bbbbbbb",
        subject: "chore: y",
        body: "",
        author: "Adam",
        time: 1_690_000_000_000,
        pushed: true,
      },
    ]);
  });

  test("survives record separators in bodies and unicode authors", () => {
    const raw = `${"c".repeat(40)}\0ccccccc\0fix: é 🚀\0a\x1e\nb\n\0Zoë O'Brien\x001700000001\x1e\n`;
    expect(parseLog(raw, () => false).map((c) => [c.subject, c.body, c.author, c.time])).toEqual([
      ["fix: é 🚀", "a\x1e\nb", "Zoë O'Brien", 1_700_000_001_000],
    ]);
    expect(parseLog("", () => true)).toEqual([]);
  });
});
