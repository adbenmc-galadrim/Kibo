import { afterEach, beforeEach, expect, test } from "bun:test";
import type { StatusId } from "@kibo/schema";
import { createGitFixture, type GitFixture, installFakeGh } from "../code/testing/git-fixture";
import { type Closer, shutdown } from "../daemon-shutdown";
import type { RpcContext } from "../rpc-extensions";
import { startCodeTracking } from "./bootstrap";
import { createObserverFixture, type ObserverFixture } from "./observer-fixture.test-helper";

const REMOTE: RpcContext = { sessionHash: "remote", remote: true };

let git: GitFixture;
let fx: ObserverFixture;
let closers: Closer[];

beforeEach(() => {
  git = createGitFixture({ remote: false });
  git.commit("chore: init", { "README.md": "# emis\n" });
  fx = createObserverFixture(2, git.repo);
  closers = [];
});
afterEach(async () => {
  await shutdown({ front: [], back: closers });
  fx.close();
  git.cleanup();
});

async function statusBecomes(key: string, statusId: StatusId, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (fx.ticket(key).statusId !== statusId) {
    if (Date.now() > end) throw new Error(`${key} is ${fx.ticket(key).statusId}, not ${statusId}`);
    await Bun.sleep(25);
  }
}

test("a branch created in a watched worktree starts its ticket without waiting for the PR poll", async () => {
  const code = startCodeTracking(fx.service, closers, { env: git.env, prPollMs: 0 });
  expect(code.poller).toBeNull();
  await code.handle({ method: "status", projectId: fx.projectId, worktree: git.repo }, REMOTE);
  git.git("branch", "feat/emis-1-connexion");
  await statusBecomes("EMIS-1", "in_progress");
  expect(fx.branchOf("EMIS-1")).toBe("feat/emis-1-connexion");
});

test("the PR poll observes the branches first, and nothing is observed once the daemon stops", async () => {
  const env = { ...git.env, ...installFakeGh(git.dir) };
  const code = startCodeTracking(fx.service, closers, { env, prPollMs: 30 });
  git.git("branch", "feat/emis-1-connexion");
  await statusBecomes("EMIS-1", "in_progress");
  await shutdown({ front: [], back: closers });
  git.git("branch", "feat/emis-2-stockage");
  await code.poller?.tick();
  await Bun.sleep(100);
  expect(fx.ticket("EMIS-2").statusId).toBe("todo");
});
