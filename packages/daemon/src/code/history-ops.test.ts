import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { abortOperation, commit, reword, undoCommit } from "./history-ops";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
const subjects = () => fx.git("log", "--format=%s").trim().split("\n");
const snapshot = () => ({
  staged: fx.git("diff", "--cached"),
  unstaged: fx.git("diff"),
  untracked: fx.git("ls-files", "--others", "--exclude-standard"),
  tree: fx.git("rev-parse", "HEAD^{tree}"),
});

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "a.txt": "a\n", "b.txt": "b\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.commit("feat: un", { "c.txt": "c\n" });
  fx.commit("feat: deux", { "d.txt": "d\n" });
  h = await (await openRepo(fx.repo, fx.env)).open(fx.repo);
});
afterEach(() => fx.cleanup());

describe("commit", () => {
  test("commits the index with the given message", async () => {
    fx.write("e.txt", "e\n");
    fx.git("add", "e.txt");
    const c = await commit(h, "feat: trois (KIB-12)\n\n- détail", false);
    expect(c).toMatchObject({ subject: "feat: trois (KIB-12)", body: "- détail", pushed: false });
    fx.write("f.txt", "f\n");
    fx.git("add", "f.txt");
    await commit(h, "feat: quatre\n\n#12 lié", false);
    expect(fx.git("log", "-1", "--format=%b").trim()).toBe("#12 lié");
    await expect(commit(h, "vide", false)).rejects.toMatchObject({ code: "GIT_FAILED" });
  });

  test("amend rewrites an unpushed head and refuses a pushed one", async () => {
    fx.write("c.txt", "c2\n");
    fx.git("add", "c.txt");
    await commit(h, "feat: deux, corrigé", true);
    expect(subjects()).toEqual(["feat: deux, corrigé", "feat: un", "chore: init"]);
    expect(fx.git("show", "--name-only", "--format=", "HEAD").trim().split("\n")).toEqual(["c.txt", "d.txt"]);
    fx.git("push", "-q", "origin", "main");
    const head = fx.git("rev-parse", "HEAD");
    await expect(commit(h, "trop tard", true)).rejects.toMatchObject({ code: "GIT_PUSHED" });
    expect(fx.git("rev-parse", "HEAD")).toBe(head);
  });
});

describe("reword", () => {
  test("rewording HEAD keeps the index", async () => {
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    await reword(h, fx.git("rev-parse", "HEAD").trim(), "feat: deux reformulé");
    expect(subjects()[0]).toBe("feat: deux reformulé");
    expect(fx.git("diff", "--cached", "--name-only").trim()).toBe("a.txt");
  });

  test("rewording an older commit keeps content, index, worktree and untracked files exactly", async () => {
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    fx.write("a.txt", "staged then edited\n");
    fx.write("b.txt", "unstaged\n");
    fx.write("new.txt", "untracked\n");
    const before = snapshot();
    await reword(h, fx.git("rev-parse", "HEAD~1").trim(), "feat: un reformulé\n\n- corps");
    expect(subjects()).toEqual(["feat: deux", "feat: un reformulé", "chore: init"]);
    expect(fx.git("log", "-1", "--skip=1", "--format=%b").trim()).toBe("- corps");
    expect(snapshot()).toEqual(before);
    expect(fx.git("stash", "list")).toBe("");
  });

  test("lines starting with # are kept, whether the commit is the head or older", async () => {
    await reword(h, fx.git("rev-parse", "HEAD").trim(), "feat: deux\n\n#12 lié");
    await reword(h, fx.git("rev-parse", "HEAD~1").trim(), "feat: un\n\n#11 lié");
    expect(fx.git("log", "--format=%b", "-2").trim().split("\n").filter(Boolean)).toEqual([
      "#12 lié",
      "#11 lié",
    ]);
  });

  test("a pushed commit, a merge in range or an operation in progress are refused", async () => {
    const head = fx.git("rev-parse", "HEAD");
    await expect(reword(h, fx.git("rev-parse", "HEAD~2").trim(), "non")).rejects.toMatchObject({
      code: "GIT_PUSHED",
    });
    expect(fx.git("rev-parse", "HEAD")).toBe(head);
    fx.git("checkout", "-q", "-b", "side", "HEAD~1");
    fx.commit("feat: côté", { "side.txt": "s\n" });
    fx.git("checkout", "-q", "main");
    fx.git("merge", "-q", "--no-ff", "-m", "merge side", "side");
    await expect(reword(h, fx.git("rev-parse", "HEAD~1").trim(), "non")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    mkdirSync(join(h.gitDir, "rebase-merge"));
    await expect(reword(h, fx.git("rev-parse", "HEAD").trim(), "non")).rejects.toMatchObject({
      code: "GIT_BUSY",
    });
  });

  test("the root commit of an unpushed repository can be reworded", async () => {
    const solo = createGitFixture({ remote: false });
    const root = solo.commit("chore: init", { "a.txt": "a\n" });
    solo.commit("feat: un", { "b.txt": "b\n" });
    const sh = await (await openRepo(solo.repo, solo.env)).open(solo.repo);
    await reword(sh, root, "chore: départ");
    expect(solo.git("log", "--format=%s").trim().split("\n")).toEqual(["feat: un", "chore: départ"]);
    solo.cleanup();
  });

  test("a rebase that fails leaves branch, index, worktree and stash intact", async () => {
    const hook = join(h.gitDir, "hooks", "pre-rebase");
    mkdirSync(dirname(hook), { recursive: true });
    writeFileSync(hook, "#!/bin/sh\necho refusé >&2\nexit 1\n");
    chmodSync(hook, 0o755);
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    fx.write("b.txt", "unstaged\n");
    fx.write("new.txt", "untracked\n");
    const before = { ...snapshot(), head: fx.git("rev-parse", "HEAD") };
    await expect(reword(h, fx.git("rev-parse", "HEAD~1").trim(), "feat: interdit")).rejects.toMatchObject({
      code: "GIT_FAILED",
    });
    expect({ ...snapshot(), head: fx.git("rev-parse", "HEAD") }).toEqual(before);
    expect(subjects()).toEqual(["feat: deux", "feat: un", "chore: init"]);
    expect(fx.git("stash", "list")).toBe("");
    expect(existsSync(join(h.gitDir, "rebase-merge"))).toBe(false);
  });

  test("an unknown sha is reported", async () => {
    await expect(reword(h, "abcdef1", "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("undoCommit", () => {
  test("undoing the head puts its changes back in the index", async () => {
    await undoCommit(h, fx.git("rev-parse", "HEAD").trim());
    expect(subjects()).toEqual(["feat: un", "chore: init"]);
    expect(fx.git("diff", "--cached", "--name-only").trim()).toBe("d.txt");
  });

  test("undoing an older commit also undoes the newer ones, nothing is lost", async () => {
    fx.write("a.txt", "staged\n");
    fx.git("add", "a.txt");
    await undoCommit(h, fx.git("rev-parse", "HEAD~1").trim());
    expect(subjects()).toEqual(["chore: init"]);
    expect(fx.git("diff", "--cached", "--name-only").trim().split("\n")).toEqual(["a.txt", "c.txt", "d.txt"]);
  });

  test("a pushed commit cannot be undone", async () => {
    const head = fx.git("rev-parse", "HEAD");
    await expect(undoCommit(h, fx.git("rev-parse", "HEAD~2").trim())).rejects.toMatchObject({
      code: "GIT_PUSHED",
    });
    expect(fx.git("rev-parse", "HEAD")).toBe(head);
  });

  test("undoing the root commit of an unpushed repository empties the branch", async () => {
    const solo = createGitFixture({ remote: false });
    const sha = solo.commit("chore: init", { "a.txt": "a\n" });
    const sh = await (await openRepo(solo.repo, solo.env)).open(solo.repo);
    await undoCommit(sh, sha);
    expect(
      Bun.spawnSync(["git", "rev-parse", "--verify", "-q", "HEAD"], { cwd: solo.repo }).exitCode,
    ).not.toBe(0);
    expect(solo.git("diff", "--cached", "--name-only").trim()).toBe("a.txt");
    solo.cleanup();
  });

  test("the root commit of a detached HEAD is refused", async () => {
    const solo = createGitFixture({ remote: false });
    const sha = solo.commit("chore: init", { "a.txt": "a\n" });
    solo.git("checkout", "-q", "--detach");
    const sh = await (await openRepo(solo.repo, solo.env)).open(solo.repo);
    await expect(undoCommit(sh, sha)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(solo.git("rev-parse", "HEAD").trim()).toBe(sha);
    solo.cleanup();
  });
});

test("abortOperation aborts a conflicting merge", async () => {
  fx.git("checkout", "-q", "-b", "other", "HEAD~1");
  fx.commit("other", { "d.txt": "other\n" });
  fx.git("checkout", "-q", "main");
  Bun.spawnSync(["git", "merge", "other"], { cwd: fx.repo, env: { ...process.env, ...fx.env } });
  await abortOperation(h);
  expect(fx.git("status", "--porcelain")).toBe("");
  await expect(abortOperation(h)).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
