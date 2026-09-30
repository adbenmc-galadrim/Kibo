import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGit, firstLine, MAX_STDERR_BYTES, MAX_STDOUT_BYTES, run, runGh } from "./run";
import { createGitFixture, type GitFixture, installFakeGh, readFakeGhLog } from "./testing/git-fixture";

let fx: GitFixture;
beforeEach(() => {
  fx = createGitFixture({ remote: false });
});
afterEach(() => fx.cleanup());

test("run returns code, stdout and stderr without a shell", async () => {
  const r = await run(["git", "rev-parse", "--is-inside-work-tree"], { cwd: fx.repo, env: fx.env });
  expect(r).toMatchObject({ code: 0, stdout: "true\n" });
  const bad = await run(["git", "rev-parse", "$(echo pwned)"], { cwd: fx.repo, env: fx.env });
  expect(bad.code).not.toBe(0);
  expect(bad.stderr).toContain("$(echo pwned)");
});

test("stdin is passed to the process", async () => {
  const git = createGit(fx.repo, fx.env);
  const sha = await git.ok(["hash-object", "--stdin"], { stdin: "hello\n" });
  expect(sha.trim()).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
});

test("ok throws GIT_FAILED with the first stderr line", async () => {
  const git = createGit(fx.repo, fx.env);
  await expect(git.ok(["rev-parse", "--verify", "nope"])).rejects.toMatchObject({ code: "GIT_FAILED" });
});

test("a missing binary and a timeout are reported", async () => {
  await expect(run(["kibo-no-such-binary"], { cwd: fx.repo })).rejects.toMatchObject({ code: "GIT_FAILED" });
  await expect(
    run(["kibo-no-such-binary"], { cwd: fx.repo, failCode: "GH_UNAVAILABLE" }),
  ).rejects.toMatchObject({
    code: "GH_UNAVAILABLE",
  });
  const started = Date.now();
  await expect(run(["sleep", "5"], { cwd: fx.repo, timeoutMs: 100 })).rejects.toMatchObject({
    code: "GIT_FAILED",
  });
  expect(Date.now() - started).toBeLessThan(2_000);
});

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === "ESRCH") return false;
    throw e;
  }
}

async function expectGone(pidFile: string): Promise<void> {
  const pids = readFileSync(pidFile, "utf8").trim().split(/\s+/).map(Number);
  expect(pids.length).toBeGreaterThan(0);
  const deadline = Date.now() + 2_000;
  while (pids.some(isAlive) && Date.now() < deadline) await Bun.sleep(20);
  expect(pids.filter(isAlive)).toEqual([]);
}

test("the output limits are exported", () => {
  expect(MAX_STDOUT_BYTES).toBe(50_000_000);
  expect(MAX_STDERR_BYTES).toBe(1_000_000);
});

test("an endless stdout stops the whole process group", async () => {
  const pidFile = join(fx.dir, "stdout.pids");
  const script = `echo $$ > ${pidFile}; sh -c 'echo $$ >> ${pidFile}; exec yes' & wait`;
  await expect(run(["sh", "-c", script], { cwd: fx.repo })).rejects.toMatchObject({ code: "TOO_LARGE" });
  await expectGone(pidFile);
});

test("an endless stderr stops the whole process group", async () => {
  const pidFile = join(fx.dir, "stderr.pids");
  const script = `echo $$ > ${pidFile}; sh -c 'echo $$ >> ${pidFile}; exec yes >&2' & wait`;
  await expect(run(["sh", "-c", script], { cwd: fx.repo })).rejects.toMatchObject({ code: "TOO_LARGE" });
  await expectGone(pidFile);
});

test("a timeout kills a child that ignores termination", async () => {
  const pidFile = join(fx.dir, "timeout.pids");
  const child = `trap '' TERM INT HUP; while :; do sleep 1; done`;
  const script = `sh -c "${child}" & echo $$ $! > ${pidFile}; wait`;
  await expect(run(["sh", "-c", script], { cwd: fx.repo, timeoutMs: 300 })).rejects.toMatchObject({
    code: "GIT_FAILED",
  });
  await expectGone(pidFile);
});

test("a timeout kills children left behind by an exited parent", async () => {
  const pidFile = join(fx.dir, "orphan.pids");
  const script = `sleep 30 & echo $! > ${pidFile}`;
  await expect(run(["sh", "-c", script], { cwd: fx.repo, timeoutMs: 300 })).rejects.toMatchObject({
    code: "GIT_FAILED",
  });
  await expectGone(pidFile);
});

test("git never prompts and ignores an inherited repository", async () => {
  process.env.GIT_DIR = "/elsewhere/.git";
  process.env.GIT_INDEX_FILE = "/elsewhere/index";
  try {
    const git = createGit(fx.repo, fx.env);
    expect((await git.ok(["rev-parse", "--show-toplevel"])).trim()).toBe(fx.repo);
    const r = await run(
      ["sh", "-c", 'printf "%s|%s|%s" "$GIT_TERMINAL_PROMPT" "$GIT_INDEX_FILE" "$LC_ALL"'],
      {
        cwd: fx.repo,
        env: { GIT_TERMINAL_PROMPT: "1" },
      },
    );
    expect(r.stdout).toBe("0||C");
  } finally {
    delete process.env.GIT_DIR;
    delete process.env.GIT_INDEX_FILE;
  }
});

test("gh neither prompts nor checks for updates", async () => {
  const r = await run(["sh", "-c", 'printf "%s|%s" "$GH_PROMPT_DISABLED" "$GH_NO_UPDATE_NOTIFIER"'], {
    cwd: fx.repo,
    env: { GH_PROMPT_DISABLED: "0", GH_NO_UPDATE_NOTIFIER: "0" },
  });
  expect(r.stdout).toBe("1|1");
});

test("runGh uses KIBO_GH and passes stdin", async () => {
  const env = { ...fx.env, ...installFakeGh(fx.dir) };
  const r = await runGh(["pr", "create", "--head=kib-1", "--body-file", "-"], {
    cwd: fx.repo,
    env,
    stdin: "b",
  });
  expect(r.stdout.trim()).toBe("https://github.com/kibo/test/pull/1");
  expect(readFakeGhLog(env)).toEqual([
    { args: ["pr", "create", "--head=kib-1", "--body-file", "-"], stdin: "b" },
  ]);
});

test("firstLine trims and keeps one line", () => {
  expect(firstLine("  fatal: x\nhint: y")).toBe("fatal: x");
});
