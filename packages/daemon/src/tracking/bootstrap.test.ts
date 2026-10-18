import { afterEach, beforeEach, expect, test } from "bun:test";
import type { StatusId } from "@kibo/schema";
import { createGitFixture, type GitFixture, installFakeGh } from "../code/testing/git-fixture";
import { type Closer, shutdown } from "../daemon-shutdown";
import type { RpcContext } from "../rpc-extensions";
import { PR_POLL_ENV, prPollMsFromEnv, startCodeTracking } from "./bootstrap";
import { createObserverFixture, type ObserverFixture } from "./observer-fixture.test-helper";

const REMOTE: RpcContext = { sessionHash: "remote", remote: true };

let git: GitFixture;
let fx: ObserverFixture;
let closers: Closer[];

beforeEach(() => {
  git = createGitFixture({ remote: false });
  git.commit("chore: init", { "README.md": "# silo\n" });
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
  git.git("branch", "feat/silo-1-connexion");
  await statusBecomes("SILO-1", "in_progress");
  expect(fx.branchOf("SILO-1")).toBe("feat/silo-1-connexion");
});

test("the PR poll observes the branches first, and nothing is observed once the daemon stops", async () => {
  const env = { ...git.env, ...installFakeGh(git.dir) };
  const code = startCodeTracking(fx.service, closers, { env, prPollMs: 30 });
  git.git("branch", "feat/silo-1-connexion");
  await statusBecomes("SILO-1", "in_progress");
  await shutdown({ front: [], back: closers });
  git.git("branch", "feat/silo-2-stockage");
  await code.poller?.tick();
  await Bun.sleep(100);
  expect(fx.ticket("SILO-2").statusId).toBe("todo");
});

test("the poll passes run before each PR poll and stop with the daemon", async () => {
  let ticks = 0;
  const pass = async () => {
    ticks += 1;
  };
  const code = startCodeTracking(fx.service, closers, { env: git.env, prPollMs: 20 }, [pass]);
  const end = Date.now() + 5_000;
  while (ticks < 2 && Date.now() < end) await Bun.sleep(10);
  expect(ticks).toBeGreaterThanOrEqual(2);
  await shutdown({ front: [], back: closers });
  const stopped = ticks;
  await code.poller?.tick();
  expect(ticks).toBe(stopped);
});

test("the PR poll interval can be set by the environment for the tests", () => {
  expect(prPollMsFromEnv({})).toBeUndefined();
  expect(prPollMsFromEnv({ [PR_POLL_ENV]: "250" })).toBe(250);
  expect(prPollMsFromEnv({ [PR_POLL_ENV]: "20" })).toBe(20);
  expect(prPollMsFromEnv({ [PR_POLL_ENV]: "0" })).toBe(0);
  for (const raw of ["vite", " 250", "250 ", "0x10", "1e3", "-5", "2.5", "19", "1"])
    expect(() => prPollMsFromEnv({ [PR_POLL_ENV]: raw })).toThrow(PR_POLL_ENV);
});

test("the daemon reads the PR poll interval from its environment", () => {
  const previous = process.env[PR_POLL_ENV];
  try {
    process.env[PR_POLL_ENV] = "0";
    expect(startCodeTracking(fx.service, closers, { env: git.env }).poller).toBeNull();
    process.env[PR_POLL_ENV] = "20";
    expect(startCodeTracking(fx.service, closers, { env: git.env }).poller).not.toBeNull();
  } finally {
    if (previous === undefined) delete process.env[PR_POLL_ENV];
    else process.env[PR_POLL_ENV] = previous;
  }
});
