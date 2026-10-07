import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import {
  type GitBranchRef,
  KiboError,
  WORKTREE_DEFAULTS,
  type WorkspaceStrategy,
  type WorktreeSettings,
} from "@kibo/schema";
import { runBounded } from "./bounded-process";
import { prepareWorktree, runShell, type ShellRunner } from "./worktree-prep";

export type PreparedWorkspace = { cwd: string; label: string };
export type GitRunner = (
  args: string[],
  cwd: string,
  timeoutMs?: number,
) => Promise<{ code: number; stdout: string; stderr: string }>;
export type PrepareInput = {
  strategy: WorkspaceStrategy;
  projectFolder: string | null;
  ticketKey: string;
  runDir: string;
  worktree: WorktreeSettings | null;
  branchRef: GitBranchRef | null;
  git?: GitRunner;
  shell?: ShellRunner;
};

const gitEnv = (): Record<string, string | undefined> => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  SSH_ASKPASS: "",
  SSH_ASKPASS_REQUIRE: "never",
  GIT_SSH_COMMAND: `${process.env.GIT_SSH_COMMAND ?? "ssh"} -o BatchMode=yes`,
});

export const runGit: GitRunner = async (args, cwd, timeoutMs) => {
  const res = await runBounded(["git", ...args], { cwd, env: gitEnv(), timeoutMs });
  if (!res.timedOut) return { code: res.code, stdout: res.stdout, stderr: res.stderr };
  const code = res.code === 0 ? 1 : res.code;
  return {
    code,
    stdout: res.stdout,
    stderr: `git ${args[0]} timed out after ${(timeoutMs ?? 0) / 1000}s\n${res.stderr}`,
  };
};

const failed = (detail: string) => new KiboError("WORKSPACE_FAILED", detail);

function requireFolder(folder: string | null): string {
  if (!folder) throw new KiboError("PROJECT_FOLDER_MISSING", "the project has no local folder");
  if (!existsSync(folder) || !statSync(folder).isDirectory())
    throw new KiboError("PROJECT_FOLDER_NOT_FOUND", `folder ${folder} does not exist`);
  return folder;
}

export async function prepareWorkspace(input: PrepareInput): Promise<PreparedWorkspace> {
  const git = input.git ?? runGit;
  switch (input.strategy) {
    case "worktree": {
      const folder = requireFolder(input.projectFolder);
      const top = await git(["rev-parse", "--show-toplevel"], folder);
      if (top.code !== 0) throw new KiboError("NOT_A_REPO", `${folder} is not a git repository`);
      return prepareWorktree({
        root: top.stdout.trim(),
        ticketKey: input.ticketKey,
        branchRef: input.branchRef,
        settings: input.worktree ?? WORKTREE_DEFAULTS,
        runDir: input.runDir,
        git,
        shell: input.shell ?? runShell,
      });
    }
    case "repo":
      return { cwd: requireFolder(input.projectFolder), label: "repo" };
    case "isolated": {
      const cwd = join(input.runDir, "workspace");
      mkdirSync(cwd, { recursive: true, mode: 0o700 });
      return { cwd, label: "isolated" };
    }
  }
}

export function writeRunContext(
  runDir: string,
  files: { path: string; content: string }[],
): { systemPromptFile: string; briefFile: string } {
  const root = resolve(runDir);
  const targets = files.map((f) => ({ file: resolve(root, f.path), content: f.content }));
  if (targets.some((t) => !t.file.startsWith(root + sep)))
    throw failed("context file outside the run folder");
  const systemPromptFile = join(root, "CLAUDE.md");
  const briefFile = join(root, "brief.md");
  const names = new Set(targets.map((t) => t.file));
  if (!names.has(systemPromptFile) || !names.has(briefFile))
    throw failed("CLAUDE.md and brief.md are required");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const t of targets) {
    mkdirSync(dirname(t.file), { recursive: true, mode: 0o700 });
    writeFileSync(t.file, t.content, { mode: 0o600 });
  }
  return { systemPromptFile, briefFile };
}
