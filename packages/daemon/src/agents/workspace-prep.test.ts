import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareWorkspace, runGit, writeRunContext } from "./workspace-prep";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-ws-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const commit = [
  "-c",
  "user.email=t@kibo.test",
  "-c",
  "user.name=t",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "-q",
];

async function git(args: string[], cwd: string): Promise<string> {
  const r = await runGit(args, cwd);
  if (r.code !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
}

async function repo(initialBranch = "main"): Promise<string> {
  const d = tmp();
  for (const args of [
    ["init", "-q", "-b", initialBranch],
    [
      "-c",
      "user.email=t@kibo.test",
      "-c",
      "user.name=t",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "init",
    ],
  ]) {
    const r = await runGit(args, d);
    if (r.code !== 0) throw new Error(r.stderr);
  }
  return d;
}

test("worktree: one per ticket, branch named after the key, reused next time", async () => {
  const folder = await repo();
  const runDir = join(tmp(), "run");
  const first = await prepareWorkspace({
    strategy: "worktree",
    projectFolder: folder,
    ticketKey: "KIB-15",
    runDir,
  });
  expect(first.label).toBe("worktree:kib-15");
  expect(first.cwd.endsWith(join(".kibo", "worktrees", "kib-15"))).toBe(true);
  expect((await runGit(["branch", "--show-current"], first.cwd)).stdout.trim()).toBe("kib-15");
  const again = await prepareWorkspace({
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
    prepareWorkspace({ strategy: "worktree", projectFolder: tmp(), ticketKey: "KIB-1", runDir }),
  ).rejects.toThrow("WORKSPACE_FAILED");
  await expect(
    prepareWorkspace({ strategy: "worktree", projectFolder: null, ticketKey: "KIB-1", runDir }),
  ).rejects.toThrow("WORKSPACE_FAILED");
});

test("repo works in the project folder, isolated in a private run folder", async () => {
  const folder = tmp();
  const runDir = join(tmp(), "run");
  expect(
    await prepareWorkspace({ strategy: "repo", projectFolder: folder, ticketKey: "KIB-1", runDir }),
  ).toEqual({
    cwd: folder,
    label: "repo",
  });
  await expect(
    prepareWorkspace({
      strategy: "repo",
      projectFolder: join(folder, "missing"),
      ticketKey: "KIB-1",
      runDir,
    }),
  ).rejects.toThrow("WORKSPACE_FAILED");
  const isolated = await prepareWorkspace({
    strategy: "isolated",
    projectFolder: null,
    ticketKey: "KIB-1",
    runDir,
  });
  expect(isolated).toEqual({ cwd: join(runDir, "workspace"), label: "isolated" });
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
      prepareWorkspace({ strategy: "worktree", projectFolder: folder, ticketKey, runDir }),
    ).rejects.toThrow("WORKSPACE_FAILED");
  }
  expect(existsSync(join(folder, ".kibo"))).toBe(false);
});

test("worktree refuses a plain folder squatting its path", async () => {
  const folder = await repo();
  mkdirSync(join(folder, ".kibo", "worktrees", "kib-2"), { recursive: true });
  await expect(
    prepareWorkspace({
      strategy: "worktree",
      projectFolder: folder,
      ticketKey: "KIB-2",
      runDir: join(tmp(), "run"),
    }),
  ).rejects.toThrow("WORKSPACE_FAILED");
});

test("a new worktree starts from main, whatever branch is checked out", async () => {
  const folder = await repo();
  const main = await git(["rev-parse", "main"], folder);
  await git(["checkout", "-q", "-b", "feature"], folder);
  await git([...commit, "--allow-empty", "-m", "feature"], folder);
  const ws = await prepareWorkspace({
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
    strategy: "worktree",
    projectFolder: folder,
    ticketKey: "KIB-4",
    runDir: join(tmp(), "run"),
  });
  expect(await git(["rev-parse", "HEAD"], ws.cwd)).toBe(head);
});
