import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { branchChanges, branchDiff, resolveBranchBase } from "./branch-changes";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;

const open = async () => (await openRepo(fx.repo, fx.env)).open(fx.repo);

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "README.md": "# emis\n", "src/old.ts": "export const old = 1;\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.git("checkout", "-q", "-b", "dev");
  fx.commit("feat: dev", { "src/dev.ts": "export const dev = 1;\n" });
  fx.git("push", "-q", "-u", "origin", "dev");
  fx.git("checkout", "-q", "-b", "feat/stockage", "origin/dev");
  h = await open();
});
afterEach(() => fx.cleanup());

const workOnBranch = () => {
  fx.commit("build: minio", { "docker/minio.yml": "image: minio\n", "README.md": "# emis\nminio\n" });
  fx.git("mv", "src/old.ts", "src/renamed.ts");
  fx.git("rm", "-q", "src/dev.ts");
  fx.git("commit", "-q", "-m", "refactor: renomme");
  fx.git("push", "-q", "-u", "origin", "feat/stockage");
  fx.commit("feat: urls", { "src/urls.ts": "export const a = 1;\nexport const b = 2;\n" });
};

describe("resolveBranchBase", () => {
  test("the first valid candidate found wins, a remote branch before a local one", async () => {
    fx.git("branch", "feat/parent", "origin/dev");
    expect(await resolveBranchBase(h, ["-x", "a..b", "missing", "origin/dev"])).toEqual({
      name: "origin/dev",
      ref: "refs/remotes/origin/dev",
    });
    expect(await resolveBranchBase(h, [null, "dev"])).toEqual({
      name: "origin/dev",
      ref: "refs/remotes/origin/dev",
    });
    expect(await resolveBranchBase(h, ["feat/parent"])).toEqual({
      name: "feat/parent",
      ref: "refs/heads/feat/parent",
    });
  });

  test("without a candidate, the default branch of the remote is the base", async () => {
    expect(await resolveBranchBase(h, [])).toEqual({ name: "origin/main", ref: "refs/remotes/origin/main" });
  });

  test("without a remote nor a candidate, there is no base", async () => {
    fx.git("remote", "remove", "origin");
    expect(await resolveBranchBase(await open(), [null])).toBeNull();
  });
});

describe("branchChanges", () => {
  test("lists what the branch changed since its merge base, committed only", async () => {
    workOnBranch();
    fx.write("src/urls.ts", "uncommitted\n");
    const changes = await branchChanges(h, ["origin/dev"]);
    expect(changes.base).toBe("origin/dev");
    expect(changes.mergeBase).toBe(fx.git("rev-parse", "origin/dev").trim());
    expect(changes.files).toEqual([
      { path: "README.md", origPath: null, kind: "modified", additions: 1, deletions: 0 },
      { path: "docker/minio.yml", origPath: null, kind: "added", additions: 1, deletions: 0 },
      { path: "src/dev.ts", origPath: null, kind: "deleted", additions: 0, deletions: 1 },
      { path: "src/renamed.ts", origPath: "src/old.ts", kind: "renamed", additions: 0, deletions: 0 },
      { path: "src/urls.ts", origPath: null, kind: "added", additions: 2, deletions: 0 },
    ]);
    expect([changes.additions, changes.deletions]).toEqual([4, 1]);
    expect(changes.commits.map((c) => [c.subject, c.pushed])).toEqual([
      ["feat: urls", false],
      ["refactor: renomme", true],
      ["build: minio", true],
    ]);
  });

  test("a branch that changed nothing yet has a base and no files", async () => {
    expect(await branchChanges(h, ["origin/dev"])).toMatchObject({
      base: "origin/dev",
      files: [],
      commits: [],
      additions: 0,
      deletions: 0,
    });
  });

  test("no base found means no branch section", async () => {
    fx.git("remote", "remove", "origin");
    expect(await branchChanges(await open(), ["nowhere"])).toEqual({
      base: null,
      mergeBase: null,
      files: [],
      additions: 0,
      deletions: 0,
      commits: [],
    });
  });
});

describe("branchDiff", () => {
  test("diffs a file between the merge base and HEAD, read only", async () => {
    workOnBranch();
    fx.write("README.md", "# emis\nminio\nnot committed\n");
    const diff = await branchDiff(h, ["origin/dev"], "README.md", null);
    expect(diff.hunkStaging).toBe(false);
    expect([diff.additions, diff.deletions]).toEqual([1, 0]);
    expect(diff.hunks[0]?.lines.map((l) => [l.kind, l.text])).toEqual([
      ["context", "# emis"],
      ["add", "minio"],
    ]);
  });

  test("a deleted or renamed file is diffed too", async () => {
    workOnBranch();
    expect((await branchDiff(h, ["origin/dev"], "src/dev.ts", null)).deletions).toBe(1);
    const renamed = await branchDiff(h, ["origin/dev"], "src/renamed.ts", "src/old.ts");
    expect(renamed).toMatchObject({ path: "src/renamed.ts", origPath: "src/old.ts", hunkStaging: false });
  });

  test("a path outside the worktree, or a branch without base, is refused", async () => {
    await expect(branchDiff(h, ["origin/dev"], ".git/config", null)).rejects.toMatchObject({
      code: "PATH_OUTSIDE_PROJECT",
    });
    fx.git("remote", "remove", "origin");
    await expect(branchDiff(await open(), [], "README.md", null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
