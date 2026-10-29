import { afterEach, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import {
  type GitBranchRef,
  KiboError,
  type SetupStep,
  WORKTREE_DEFAULTS,
  type WorktreeSettings,
} from "@kibo/schema";
import { type GitRunner, runGit } from "../runs/workspace-prep";
import { cleanupTmp, commit, git, repo, tmp } from "../testing/git-test-kit";
import {
  assertWorktreeSettings,
  FETCH_TIMEOUT_MS,
  prepareWorktree,
  recentCommits,
  runShell,
  type WorktreeInput,
  worktreeBase,
  worktreeBranch,
} from "./worktree-prep";

afterEach(cleanupTmp);

const settings = (patch: Partial<WorktreeSettings>): WorktreeSettings => ({ ...WORKTREE_DEFAULTS, ...patch });
const input = (root: string, patch: Partial<WorktreeInput> = {}): WorktreeInput => ({
  root,
  ticketKey: "SILO-12",
  branchRef: null,
  settings: WORKTREE_DEFAULTS,
  runDir: join(tmp(), "run"),
  git: runGit,
  shell: runShell,
  ...patch,
});
const branchRef = (branch: string, base: string | null = null): GitBranchRef => ({
  kind: "git_branch",
  branch,
  base,
});
const SETUP = "git worktree add {path} {branch}";

test("branch and base come from the ticket ref first, then the key and the project", () => {
  expect(worktreeBranch("SILO-12", null)).toBe("silo-12");
  expect(worktreeBranch("SILO-12", branchRef("feat/x"))).toBe("feat/x");
  expect(worktreeBase(settings({ baseRef: "origin/dev" }), null)).toBe("origin/dev");
  expect(worktreeBase(settings({ baseRef: "origin/dev" }), branchRef("feat/x", "feat/parent"))).toBe(
    "feat/parent",
  );
});

test("defaults reproduce the current behaviour: .kibo/worktrees/<key> from main", async () => {
  const root = await repo();
  const ws = await prepareWorktree(input(root));
  expect(ws).toEqual({ cwd: join(root, ".kibo", "worktrees", "silo-12"), label: "worktree:silo-12" });
  expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], ws.cwd)).toBe("silo-12");
  expect(readFileSync(join(root, ".git", "info", "exclude"), "utf8")).toContain(".kibo/");
});

test("a sibling template with a slash branch lands beside the repo and is adopted next time", async () => {
  const parent = tmp();
  const root = await repo("main", join(parent, "silo"));
  const ref = branchRef("feat/schema-clients");
  const s = settings({ pathTemplate: "../silo-{slug}" });
  const first = await prepareWorktree(input(root, { branchRef: ref, settings: s }));
  expect(first).toEqual({
    cwd: join(parent, "silo-feat-schema-clients"),
    label: "worktree:feat/schema-clients",
  });
  expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], first.cwd)).toBe("feat/schema-clients");
  const second = await prepareWorktree(input(root, { branchRef: ref, settings: s }));
  expect(second.cwd).toBe(first.cwd);
  const exclude = join(root, ".git", "info", "exclude");
  expect(existsSync(exclude) && readFileSync(exclude, "utf8").includes(".kibo/")).toBe(false);
});

test("an existing worktree is adopted as is, but another repository at its path is refused", async () => {
  const parent = tmp();
  const root = await repo("main", join(parent, "silo"));
  await git(["worktree", "add", "-b", "feat/y", join(parent, "silo-feat-y")], root);
  const s = settings({ pathTemplate: "../silo-{slug}", setup: "false" });
  const adopted = await prepareWorktree(input(root, { branchRef: branchRef("feat/y"), settings: s }));
  expect(adopted.cwd).toBe(join(parent, "silo-feat-y"));
  await repo("main", join(parent, "silo-feat-z"));
  await expect(
    prepareWorktree(input(root, { branchRef: branchRef("feat/z"), settings: s })),
  ).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: expect.stringContaining("is not a worktree of"),
  });
});

test("a remote base is fetched and the branch starts from it, never from HEAD", async () => {
  const upstream = await repo("main");
  await git(["checkout", "-q", "-b", "dev"], upstream);
  await git([...commit, "--allow-empty", "-m", "dev only"], upstream);
  const devSha = await git(["rev-parse", "HEAD"], upstream);
  await git(["checkout", "-q", "main"], upstream);
  const root = await repo("main");
  await git(["remote", "add", "origin", upstream], root);
  const ws = await prepareWorktree(input(root, { settings: settings({ baseRef: "origin/dev" }) }));
  expect(await git(["rev-parse", "HEAD"], ws.cwd)).toBe(devSha);
});

test("a missing remote or a failed fetch is a GIT_FAILED, not a silent fallback", async () => {
  const root = await repo();
  const s = settings({ baseRef: "origin/dev" });
  await expect(prepareWorktree(input(root, { settings: s }))).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: "base branch origin/dev not found locally",
  });
  await git(["remote", "add", "origin", join(tmp(), "nowhere")], root);
  await expect(prepareWorktree(input(root, { settings: s }))).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: expect.stringContaining("git fetch origin dev failed"),
  });
  expect(await git(["branch", "--list", "silo-12"], root)).toBe("");
});

test("a branch that already exists is neither fetched nor recreated", async () => {
  const root = await repo();
  await git(["branch", "silo-12"], root);
  const calls: string[][] = [];
  const spy: GitRunner = (args, cwd, timeoutMs) => {
    calls.push(args);
    return runGit(args, cwd, timeoutMs);
  };
  await prepareWorktree(input(root, { settings: settings({ baseRef: "origin/dev" }), git: spy }));
  expect(calls.some((a) => a[0] === "fetch" || a[0] === "branch")).toBe(false);
});

test("the fetch is bounded in time", async () => {
  const upstream = await repo("main");
  const root = await repo("main");
  await git(["remote", "add", "origin", upstream], root);
  const timeouts: (number | undefined)[] = [];
  const spy: GitRunner = (args, cwd, timeoutMs) => {
    if (args[0] === "fetch") timeouts.push(timeoutMs);
    return runGit(args, cwd, timeoutMs);
  };
  await prepareWorktree(input(root, { settings: settings({ baseRef: "origin/main" }), git: spy }));
  expect(timeouts).toEqual([FETCH_TIMEOUT_MS]);
});

test("a stacked branch starts from its local parent branch", async () => {
  const root = await repo();
  await git(["checkout", "-q", "-b", "feat/parent"], root);
  await git([...commit, "--allow-empty", "-m", "parent"], root);
  const parentSha = await git(["rev-parse", "HEAD"], root);
  await git(["checkout", "-q", "main"], root);
  const ws = await prepareWorktree(input(root, { branchRef: branchRef("feat/child", "feat/parent") }));
  expect(await git(["rev-parse", "HEAD"], ws.cwd)).toBe(parentSha);
});

test("a setup command creates the worktree, gets the variables, and is logged", async () => {
  const root = await repo();
  const runDir = join(tmp(), "run");
  const s = settings({
    setup: `echo "$KIBO_BRANCH $KIBO_TICKET" && test "$KIBO_WORKTREE" = {path} && ${SETUP}`,
  });
  const ws = await prepareWorktree(input(root, { settings: s, runDir }));
  expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], ws.cwd)).toBe("silo-12");
  const log = readFileSync(join(runDir, "setup.log"), "utf8");
  expect(log).toContain("silo-12 SILO-12");
  expect(log).toContain(`$ echo`);
});

const IFS = "$".concat("{IFS}");
const HOSTILE = [
  `$(touch${IFS}pwned)`,
  `\`touch${IFS}pwned\``,
  `x"$(touch${IFS}pwned)"`,
  `x'$(touch${IFS}pwned)'`,
];

test("a branch with shell characters never reaches a shell, whatever the template quoting", async () => {
  const root = await repo();
  let calls = 0;
  const shell: typeof runShell = (command, cwd, env, timeoutMs) => {
    calls += 1;
    return runShell(command, cwd, env, timeoutMs);
  };
  for (const branch of HOSTILE)
    for (const setup of [
      `echo {branch} && ${SETUP}`,
      `echo "{branch}" && ${SETUP}`,
      `echo '{branch}' && ${SETUP}`,
    ]) {
      const ref = branchRef(branch);
      await expect(
        prepareWorktree(input(root, { branchRef: ref, settings: settings({ setup }), shell })),
      ).rejects.toMatchObject({
        code: "WORKSPACE_FAILED",
      });
    }
  expect(calls).toBe(0);
  expect(existsSync(join(root, "pwned"))).toBe(false);
  expect(await git(["branch", "--list"], root)).toBe("* main");
});

test("variable values reach the setup command through its environment only", async () => {
  const root = await repo();
  const seen: { command: string; env: Record<string, string> }[] = [];
  const shell: typeof runShell = (command, cwd, env, timeoutMs) => {
    seen.push({ command, env });
    return runShell(command, cwd, env, timeoutMs);
  };
  const setup = `printf '%s|%s|%s|%s' {branch} "{slug}" {key} {path} > seen.txt && ${SETUP}`;
  const ws = await prepareWorktree(
    input(root, { branchRef: branchRef("feat/x"), settings: settings({ setup }), shell }),
  );
  expect(await git(["rev-parse", "--abbrev-ref", "HEAD"], ws.cwd)).toBe("feat/x");
  expect(readFileSync(join(root, "seen.txt"), "utf8")).toBe(`feat/x|feat-x|silo-12|${ws.cwd}`);
  const [call] = seen;
  expect(call?.command).not.toContain("feat");
  expect(call?.command).toContain("$".concat("{KIBO_BRANCH}"));
  expect(call?.env).toMatchObject({
    KIBO_BRANCH: "feat/x",
    KIBO_SLUG: "feat-x",
    KIBO_KEY: "silo-12",
    KIBO_PATH: ws.cwd,
    KIBO_WORKTREE: ws.cwd,
    KIBO_TICKET: "SILO-12",
  });
});

test("a committed symlink cannot move the worktree out of the repository", async () => {
  const root = await repo();
  const elsewhere = tmp();
  symlinkSync(elsewhere, join(root, ".kibo"));
  await expect(prepareWorktree(input(root))).rejects.toMatchObject({ code: "WORKSPACE_FAILED" });
  expect(readdirSync(elsewhere)).toEqual([]);
  expect(await git(["branch", "--list"], root)).toBe("* main");
});

test("a git command past its deadline is killed with its children", async () => {
  const root = await repo();
  const started = Date.now();
  const res = await runGit(["-c", "alias.slow=!sleep 5", "slow"], root, 200);
  expect(res.code).not.toBe(0);
  expect(res.stderr).toContain("timed out");
  expect(Date.now() - started).toBeLessThan(4000);
});

test("a branch or a base that looks like an option is refused before touching git", async () => {
  const root = await repo();
  for (const ref of [branchRef("-x"), branchRef("feat/x", "origin/--upload-pack=touch")]) {
    await expect(prepareWorktree(input(root, { branchRef: ref }))).rejects.toMatchObject({
      code: "WORKSPACE_FAILED",
    });
  }
  expect(await git(["branch", "--list"], root)).toBe("* main");
});

test("a setup command that lies, or lands on the wrong branch, fails with its output", async () => {
  const root = await repo();
  await expect(
    prepareWorktree(input(root, { settings: settings({ setup: "echo nothing happened" }) })),
  ).rejects.toMatchObject({ code: "WORKSPACE_FAILED", detail: expect.stringContaining("nothing happened") });
  await expect(
    prepareWorktree(input(root, { settings: settings({ setup: "git worktree add -b other {path} main" }) })),
  ).rejects.toMatchObject({ code: "WORKSPACE_FAILED", detail: expect.stringContaining("expected silo-12") });
});

test("a setup command reports its start, then its status and duration, with the values shown", async () => {
  const root = await repo();
  const steps: SetupStep[] = [];
  const s = settings({ setup: `${SETUP} && echo {key}` });
  await prepareWorktree(input(root, { settings: s, onSetup: (step) => steps.push(step) }));
  expect(steps.map((step) => step.status)).toEqual(["running", "done"]);
  expect(steps[0]?.command).toBe(`git worktree add ${root}/.kibo/worktrees/silo-12 silo-12 && echo silo-12`);
  expect(steps[0]?.durationMs).toBeUndefined();
  expect(steps[1]?.durationMs).toBeGreaterThanOrEqual(0);
});

test("a failing or late setup command reports a failed step", async () => {
  const root = await repo();
  const steps: SetupStep[] = [];
  const onSetup = (step: SetupStep) => steps.push(step);
  await prepareWorktree(input(root, { settings: settings({ setup: "exit 3" }), onSetup })).catch(() => {});
  const shell: typeof runShell = (command, cwd, env) => runShell(command, cwd, env, 100);
  await prepareWorktree(input(root, { settings: settings({ setup: "sleep 5" }), shell, onSetup })).catch(
    () => {},
  );
  expect(steps.map((step) => step.status)).toEqual(["running", "failed", "running", "failed"]);
});

test("a failing setup command reports its exit code and the tail of its output", async () => {
  const root = await repo();
  const setup = "for i in $(seq 1 30); do echo line$i; done; exit 3";
  const failure = await prepareWorktree(input(root, { settings: settings({ setup }) })).catch(
    (e: unknown) => e,
  );
  expect(failure).toMatchObject({ code: "WORKSPACE_FAILED" });
  const detail = failure instanceof KiboError ? failure.detail : "";
  expect(detail.split("\n")).toEqual([
    "setup command exited with 3:",
    ...Array.from({ length: 20 }, (_, i) => `line${i + 11}`),
  ]);
});

test("a setup command past its deadline is killed with its children", async () => {
  const root = await repo();
  const shell: typeof runShell = (command, cwd, env) => runShell(command, cwd, env, 200);
  const started = Date.now();
  await expect(
    prepareWorktree(input(root, { settings: settings({ setup: "sleep 5; echo late" }), shell })),
  ).rejects.toMatchObject({ code: "TIMEOUT" });
  expect(Date.now() - started).toBeLessThan(4000);
});

test("a template that leaves the repository is refused before touching git", async () => {
  const root = await repo();
  for (const pathTemplate of ["../../{slug}", "/tmp/{slug}", "{slug}/../../x"]) {
    await expect(
      prepareWorktree(input(root, { settings: settings({ pathTemplate }) })),
    ).rejects.toMatchObject({
      code: "WORKSPACE_FAILED",
    });
  }
  expect(await git(["worktree", "list", "--porcelain"], root)).not.toContain("silo-12");
  expect(await git(["branch", "--list", "silo-12"], root)).toBe("");
});

test("settings are checked before they are saved", () => {
  expect(() =>
    assertWorktreeSettings(settings({ pathTemplate: "../silo-{slug}", setup: SETUP })),
  ).not.toThrow();
  for (const bad of [
    settings({ pathTemplate: "/tmp/{slug}" }),
    settings({ pathTemplate: "../../x/{slug}" }),
    settings({ pathTemplate: "{nope}" }),
    settings({ setup: "make {nope}" }),
    settings({ setup: "pnpm worktree '{branch}'" }),
  ]) {
    expect(() => assertWorktreeSettings(bad)).toThrow("INVALID_INPUT");
  }
});

test("recent commits are the short hash and subject of the branch since its base, newest first, at most max", async () => {
  const root = await repo();
  await git(["switch", "-q", "-c", "feat/x"], root);
  for (const n of [1, 2, 3]) await git([...commit, "--allow-empty", "-m", `feat: étape ${n}`], root);
  const lines = await recentCommits(runGit, root, "main");
  expect(lines.map((l) => l.replace(/^[0-9a-f]+ /, ""))).toEqual([
    "feat: étape 3",
    "feat: étape 2",
    "feat: étape 1",
  ]);
  expect(lines[0]).toBe(`${await git(["rev-parse", "--short", "HEAD"], root)} feat: étape 3`);
  expect(await recentCommits(runGit, root, "main", 2)).toHaveLength(2);
  expect(await recentCommits(runGit, root, "feat/x")).toEqual([]);
});

test("an unknown base gives no commits instead of failing the run", async () => {
  const root = await repo();
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    expect(await recentCommits(runGit, root, "origin/nowhere")).toEqual([]);
  } finally {
    console.error = original;
  }
  expect(errors).toHaveLength(1);
});
