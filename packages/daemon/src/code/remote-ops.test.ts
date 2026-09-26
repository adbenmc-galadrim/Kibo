import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readStatus } from "./read";
import { createPr, ghStatus, prForBranch, prState, push, toPrInfo } from "./remote-ops";
import { openRepo, type WorktreeHandle } from "./repo";
import { createGitFixture, type GitFixture, installFakeGh, readFakeGhLog } from "./testing/git-fixture";

let fx: GitFixture;
let h: WorktreeHandle;
let gh: Record<string, string>;

beforeEach(async () => {
  fx = createGitFixture();
  fx.commit("chore: init", { "a.txt": "a\n" });
  fx.git("push", "-q", "-u", "origin", "main");
  fx.git("checkout", "-q", "-b", "kib-12");
  fx.commit("feat: schéma (KIB-12)", { "b.txt": "b\n" });
  gh = installFakeGh(fx.dir);
  h = await (await openRepo(fx.repo, { ...fx.env, ...gh })).open(fx.repo);
});
afterEach(() => fx.cleanup());

test("push publishes the branch with an upstream, never forcing", async () => {
  await push(h);
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).toContain(fx.git("rev-parse", "HEAD").trim());
  const s = await readStatus(h);
  expect(s.upstream).toBe("origin/kib-12");
  expect(s.commits.every((c) => c.pushed)).toBe(true);
  fx.git("commit", "-q", "--amend", "-m", "réécrit");
  await expect(push(h)).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: expect.stringContaining("failed to push"),
  });
});

test("a detached HEAD cannot be pushed", async () => {
  fx.git("checkout", "-q", "--detach");
  await expect(push(h)).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("createPr pushes then calls gh with safe arguments and the body on stdin", async () => {
  const pr = await createPr(h, {
    title: "--title-like: x",
    body: "## Ticket\nKIB-12",
    base: "main",
    draft: true,
    reviewers: ["adam", "kibo/core"],
  });
  expect(pr).toEqual({ number: 1, url: "https://github.com/kibo/test/pull/1", state: "draft" });
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).not.toBe("");
  expect(readFakeGhLog(gh)).toContainEqual({
    args: [
      "pr",
      "create",
      "--head=kib-12",
      "--base=main",
      "--title=--title-like: x",
      "--body-file",
      "-",
      "--draft",
      "--reviewer=adam,kibo/core",
    ],
    stdin: "## Ticket\nKIB-12",
  });
  expect(await prForBranch(h)).toEqual({
    number: 1,
    url: "https://github.com/kibo/test/pull/1",
    state: "draft",
  });
});

test("an unknown base is refused before any push or gh call", async () => {
  await expect(
    createPr(h, { title: "x", body: "", base: "nope", draft: false, reviewers: [] }),
  ).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(readFakeGhLog(gh)).toEqual([]);
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).toBe("");
});

test("gh failures and absence are reported", async () => {
  const failing = await (await openRepo(fx.repo, { ...fx.env, ...gh, FAKE_GH_FAIL: "1" })).open(fx.repo);
  await expect(
    createPr(failing, { title: "x", body: "", base: "main", draft: false, reviewers: [] }),
  ).rejects.toMatchObject({
    code: "GH_FAILED",
  });
  const missing = await (await openRepo(fx.repo, { ...fx.env, KIBO_GH: join(fx.dir, "no-gh") })).open(
    fx.repo,
  );
  expect(await ghStatus(missing)).toMatchObject({ available: false });
  expect(await ghStatus(h)).toEqual({ available: true, detail: null });
  expect(await prForBranch(h)).toBeNull();
});

test("PR states map from gh JSON", async () => {
  await createPr(h, { title: "x", body: "", base: "main", draft: false, reviewers: [] });
  const state = gh.FAKE_GH_STATE ?? "";
  const prs = JSON.parse(readFileSync(state, "utf8")) as { state: string }[];
  writeFileSync(state, JSON.stringify(prs.map((p) => ({ ...p, state: "MERGED" }))));
  expect(await prState("https://github.com/kibo/test/pull/1", fx.repo, { ...fx.env, ...gh })).toMatchObject({
    state: "merged",
  });
  expect(
    toPrInfo('{"number":2,"url":"https://github.com/a/b/pull/2","state":"OPEN","isDraft":true}').state,
  ).toBe("draft");
  expect(() => toPrInfo("not json")).toThrow(expect.objectContaining({ code: "GH_FAILED" }));
});

test("reviewers that are not GitHub logins are refused before any push or gh call", async () => {
  await expect(
    createPr(h, { title: "x", body: "", base: "main", draft: false, reviewers: ["--admin"] }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(readFakeGhLog(gh)).toEqual([]);
  expect(fx.git("ls-remote", "origin", "kib-12").trim()).toBe("");
});

test("prState refuses anything but a pull request URL", async () => {
  await expect(prState("--web", fx.repo, { ...fx.env, ...gh })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  expect(readFakeGhLog(gh)).toEqual([]);
});
