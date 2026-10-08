import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanupTmp, commit, git, repo, tmp } from "./git-test-kit";
import { type GitRunner, prepareWorkspace, runGit, writeRunContext } from "./workspace-prep";

afterEach(cleanupTmp);

test("worktree: one per ticket, branch named after the key, reused next time", async () => {
  const folder = await repo();
  const runDir = join(tmp(), "run");
  const first = await prepareWorkspace({
    worktree: null,
    branchRef: null,
    strategy: "worktree",
    projectFolder: folder,
    ticketKey: "KIB-15",
    runDir,
  });
  expect(first.label).toBe("worktree:kib-15");
  expect(first.cwd.endsWith(join(".kibo", "worktrees", "kib-15"))).toBe(true);
  expect((await runGit(["branch", "--show-current"], first.cwd)).stdout.trim()).toBe("kib-15");
  const again = await prepareWorkspace({
    worktree: null,
    branchRef: null,
    strategy: "worktree",
    projectFolder: folder,
    ticketKey: "KIB-15",
    runDir,
  });
  expect(again.cwd).toBe(first.cwd);
  expect((await runGit(["status", "--porcelain"], folder)).stdout).toBe("");
  const exclude = readFileSync(join(folder, ".git", "info", "exclude"), "utf8");
  expect(exclude.split("\n").filter((l) => l === ".kibo/")).toHaveLength(1);
});

test("worktree needs a git folder", async () => {
  const runDir = join(tmp(), "run");
  await expect(
    prepareWorkspace({
      worktree: null,
      branchRef: null,
      strategy: "worktree",
      projectFolder: tmp(),
      ticketKey: "KIB-1",
      runDir,
    }),
  ).rejects.toThrow("NOT_A_REPO");
  await expect(
    prepareWorkspace({
      worktree: null,
      branchRef: null,
      strategy: "worktree",
      projectFolder: null,
      ticketKey: "KIB-1",
      runDir,
    }),
  ).rejects.toThrow("PROJECT_FOLDER_MISSING");
});

test("repo works in the project folder, isolated in a private run folder", async () => {
  const folder = tmp();
  const runDir = join(tmp(), "run");
  expect(
    await prepareWorkspace({
      worktree: null,
      branchRef: null,
      strategy: "repo",
      projectFolder: folder,
      ticketKey: "KIB-1",
      runDir,
    }),
  ).toEqual({
    cwd: folder,
    label: "repo",
    commits: [],
  });
  await expect(
    prepareWorkspace({
      worktree: null,
      branchRef: null,
      strategy: "repo",
      projectFolder: join(folder, "missing"),
      ticketKey: "KIB-1",
      runDir,
    }),
  ).rejects.toThrow("PROJECT_FOLDER_NOT_FOUND");
  const isolated = await prepareWorkspace({
    worktree: null,
    branchRef: null,
    strategy: "isolated",
    projectFolder: null,
    ticketKey: "KIB-1",
    runDir,
  });
  expect(isolated).toEqual({ cwd: join(runDir, "workspace"), label: "isolated", commits: [] });
  expect(existsSync(isolated.cwd)).toBe(true);
});

test("the run context is written privately and never outside the run folder", () => {
  const runDir = join(tmp(), "run");
  const out = writeRunContext(runDir, [
    { path: "context/1-workspace/guidelines/git.md", content: "# Git" },
    { path: "CLAUDE.md", content: "# Guidelines Kibo" },
    { path: "brief.md", content: "# KIB-1" },
  ]);
  expect(out).toEqual({ systemPromptFile: join(runDir, "CLAUDE.md"), briefFile: join(runDir, "brief.md") });
  expect(readFileSync(join(runDir, "context/1-workspace/guidelines/git.md"), "utf8")).toBe("# Git");
  expect(statSync(out.systemPromptFile).mode & 0o777).toBe(0o600);
  expect(statSync(runDir).mode & 0o777).toBe(0o700);
  expect(() => writeRunContext(runDir, [{ path: "../evil.md", content: "" }])).toThrow("WORKSPACE_FAILED");
  expect(() => writeRunContext(join(tmp(), "r2"), [{ path: "brief.md", content: "" }])).toThrow(
    "WORKSPACE_FAILED",
  );
});

test("worktree refuses a ticket key that is not a ticket key", async () => {
  const folder = await repo();
  const runDir = join(tmp(), "run");
  for (const ticketKey of ["../../evil", "KIB-1/../x", "-b", ""]) {
    await expect(
      prepareWorkspace({
        worktree: null,
        branchRef: null,
        strategy: "worktree",
        projectFolder: folder,
        ticketKey,
        runDir,
      }),
    ).rejects.toThrow("WORKSPACE_FAILED");
  }
  expect(existsSync(join(folder, ".kibo"))).toBe(false);
});

test("worktree refuses a plain folder squatting its path", async () => {
  const folder = await repo();
  mkdirSync(join(folder, ".kibo", "worktrees", "kib-2"), { recursive: true });
  await expect(
    prepareWorkspace({
      worktree: null,
      branchRef: null,
      strategy: "worktree",
      projectFolder: folder,
      ticketKey: "KIB-2",
      runDir: join(tmp(), "run"),
    }),
  ).rejects.toThrow("GIT_FAILED");
});

test("a new worktree starts from main, whatever branch is checked out", async () => {
  const folder = await repo();
  const main = await git(["rev-parse", "main"], folder);
  await git(["checkout", "-q", "-b", "feature"], folder);
  await git([...commit, "--allow-empty", "-m", "feature"], folder);
  const ws = await prepareWorkspace({
    worktree: null,
    branchRef: null,
    strategy: "worktree",
    projectFolder: folder,
    ticketKey: "KIB-3",
    runDir: join(tmp(), "run"),
  });
  expect(await git(["rev-parse", "HEAD"], ws.cwd)).toBe(main);
});

test("without a main branch the new worktree starts from HEAD", async () => {
  const folder = await repo("trunk");
  await git([...commit, "--allow-empty", "-m", "second"], folder);
  const head = await git(["rev-parse", "HEAD"], folder);
  const ws = await prepareWorkspace({
    worktree: null,
    branchRef: null,
    strategy: "worktree",
    projectFolder: folder,
    ticketKey: "KIB-4",
    runDir: join(tmp(), "run"),
  });
  expect(await git(["rev-parse", "HEAD"], ws.cwd)).toBe(head);
});

test("each failure of the workspace has its own code", async () => {
  const runDir = join(tmp(), "run");
  const base = { ticketKey: "KIB-7", runDir };
  await expect(
    prepareWorkspace({ ...base, worktree: null, branchRef: null, strategy: "repo", projectFolder: null }),
  ).rejects.toMatchObject({
    code: "PROJECT_FOLDER_MISSING",
    detail: "the project has no local folder",
  });
  const gone = join(tmp(), "gone");
  await expect(
    prepareWorkspace({ ...base, worktree: null, branchRef: null, strategy: "repo", projectFolder: gone }),
  ).rejects.toMatchObject({
    code: "PROJECT_FOLDER_NOT_FOUND",
    detail: `folder ${gone} does not exist`,
  });
  await expect(
    prepareWorkspace({
      ...base,
      worktree: null,
      branchRef: null,
      strategy: "worktree",
      projectFolder: tmp(),
    }),
  ).rejects.toMatchObject({
    code: "NOT_A_REPO",
  });
});

test("a refusal of git is a GIT_FAILED with git's message", async () => {
  const folder = await repo();
  const git: GitRunner = async (args, cwd) =>
    args[0] === "worktree"
      ? { code: 128, stdout: "", stderr: "fatal: 'x' is a missing but locked\n" }
      : runGit(args, cwd);
  await expect(
    prepareWorkspace({
      worktree: null,
      branchRef: null,
      strategy: "worktree",
      projectFolder: folder,
      ticketKey: "KIB-7",
      runDir: join(tmp(), "run"),
      git,
    }),
  ).rejects.toMatchObject({
    code: "GIT_FAILED",
    detail: "git worktree add failed: fatal: 'x' is a missing but locked",
  });
});

test("a worktree brings the commits of its branch since the base, other spaces bring none", async () => {
  const folder = await repo();
  const runDir = join(tmp(), "run");
  const input = {
    worktree: null,
    branchRef: null,
    strategy: "worktree" as const,
    projectFolder: folder,
    ticketKey: "KIB-15",
    runDir,
  };
  const first = await prepareWorkspace(input);
  expect(first.commits).toEqual([]);
  await git([...commit, "--allow-empty", "-m", "feat: premier pas"], first.cwd);
  const hash = await git(["rev-parse", "--short", "HEAD"], first.cwd);
  const again = await prepareWorkspace(input);
  expect(again.commits).toEqual([`${hash} feat: premier pas`]);
  const inRepo = await prepareWorkspace({ ...input, strategy: "repo" });
  expect(inRepo.commits).toEqual([]);
});
