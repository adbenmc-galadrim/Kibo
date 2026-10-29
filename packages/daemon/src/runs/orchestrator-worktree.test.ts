import { expect, test } from "bun:test";
import { join } from "node:path";
import { WORKTREE_DEFAULTS } from "@kibo/schema";
import { cleanupTmp, commit, git, repo, tmp } from "../testing/git-test-kit";
import { assign, cleanHarness, run, setup, testAgent, waitUntil } from "./orchestrator.test-helper";

cleanHarness();

async function mergedAndDeletedParent(): Promise<string> {
  const upstream = await repo("main");
  await git(["checkout", "-q", "-b", "dev"], upstream);
  await git(["checkout", "-q", "-b", "feat/matrice-droits"], upstream);
  await git([...commit, "--allow-empty", "-m", "parent"], upstream);
  await git(["checkout", "-q", "dev"], upstream);
  await git([...commit.slice(0, 6), "merge", "-q", "--no-ff", "--no-edit", "feat/matrice-droits"], upstream);
  await git(["checkout", "-q", "main"], upstream);
  const folder = join(tmp(), "clone");
  await git(["clone", "-q", upstream, folder], tmp());
  await git(["branch", "-D", "feat/matrice-droits"], upstream);
  return folder;
}

test("a run whose parent branch was merged and deleted starts from the project base and journals it", async () => {
  try {
    const folder = await mergedAndDeletedParent();
    const h = setup({
      scenario: "done",
      profiles: [testAgent({ workspace: "worktree" })],
      meta: { folder, worktree: { ...WORKTREE_DEFAULTS, baseRef: "origin/dev" } },
      externalRefs: { t1: [{ kind: "git_branch", branch: "feat/perimetre", base: "feat/matrice-droits" }] },
    });
    const r = assign(h, "t1");
    await waitUntil(() => run(h, r.id).state === "done");
    const events = h.orch.log(r.id).map((entry) => entry.event);
    expect(events.filter((event) => event.type === "base_fallback")).toEqual([
      { type: "base_fallback", base: "feat/matrice-droits", from: "origin/dev" },
    ]);
  } finally {
    cleanupTmp();
  }
});

test("a ticket whose run failed at launch can be launched again once the cause is fixed", async () => {
  try {
    const folder = await repo("main");
    const h = setup({
      scenario: "done",
      profiles: [testAgent({ workspace: "worktree" })],
      meta: { folder, worktree: WORKTREE_DEFAULTS },
      externalRefs: { t1: [{ kind: "git_branch", branch: "feat/perimetre", base: "feat/absente" }] },
    });
    const first = assign(h, "t1");
    await waitUntil(() => run(h, first.id).state === "failed");
    expect(run(h, first.id)).toMatchObject({
      startedAt: null,
      error: "GIT_FAILED: base branch feat/absente not found locally",
    });
    await git(["branch", "feat/absente"], folder);
    const second = assign(h, "t1");
    await waitUntil(() => run(h, second.id).state === "done");
    expect(second.resumedFrom).toBeNull();
  } finally {
    cleanupTmp();
  }
});
