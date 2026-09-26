import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { KiboError, TicketKey, type WorkspaceStrategy } from "@kibo/schema";

export type PreparedWorkspace = { cwd: string; label: string };
export type GitRunner = (
  args: string[],
  cwd: string,
) => Promise<{ code: number; stdout: string; stderr: string }>;
export type PrepareInput = {
  strategy: WorkspaceStrategy;
  projectFolder: string | null;
  ticketKey: string;
  runDir: string;
  git?: GitRunner;
};

export const runGit: GitRunner = async (args, cwd) => {
  const proc = Bun.spawn(["git", ...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
};

const failed = (detail: string) => new KiboError("WORKSPACE_FAILED", detail);

function requireFolder(folder: string | null): string {
  if (!folder) throw failed("the project has no local folder");
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw failed(`folder ${folder} does not exist`);
  return folder;
}

function branchFor(ticketKey: string): string {
  const parsed = TicketKey.safeParse(ticketKey);
  if (!parsed.success) throw failed(`invalid ticket key ${JSON.stringify(ticketKey)}`);
  return parsed.data.toLowerCase();
}

async function excludeKiboFolder(root: string, git: GitRunner): Promise<void> {
  const res = await git(["rev-parse", "--git-path", "info/exclude"], root);
  if (res.code !== 0) throw failed(`cannot locate info/exclude: ${res.stderr.trim()}`);
  const relative = res.stdout.trim();
  const file = isAbsolute(relative) ? relative : join(root, relative);
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (current.split("\n").includes(".kibo/")) return;
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${current.length > 0 && !current.endsWith("\n") ? "\n" : ""}.kibo/\n`);
}

async function defaultBase(root: string, git: GitRunner): Promise<string> {
  const main = await git(["rev-parse", "--verify", "--quiet", "refs/heads/main"], root);
  return main.code === 0 ? "main" : "HEAD";
}

async function prepareWorktree(input: PrepareInput, git: GitRunner): Promise<PreparedWorkspace> {
  const branch = branchFor(input.ticketKey);
  const folder = requireFolder(input.projectFolder);
  const top = await git(["rev-parse", "--show-toplevel"], folder);
  if (top.code !== 0) throw failed(`${folder} is not a git repository`);
  const root = top.stdout.trim();
  const path = join(root, ".kibo", "worktrees", branch);
  await excludeKiboFolder(root, git);
  if (existsSync(path)) {
    const own = await git(["rev-parse", "--show-toplevel"], path);
    if (own.code !== 0 || realpathSync(own.stdout.trim()) !== realpathSync(path)) {
      throw failed(`${path} exists but is not a worktree`);
    }
    return { cwd: path, label: `worktree:${branch}` };
  }
  const known = await git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], root);
  const args =
    known.code === 0
      ? ["worktree", "add", path, branch]
      : ["worktree", "add", "-b", branch, path, await defaultBase(root, git)];
  const added = await git(args, root);
  if (added.code !== 0) throw failed(`git worktree add failed: ${added.stderr.trim()}`);
  return { cwd: path, label: `worktree:${branch}` };
}

export async function prepareWorkspace(input: PrepareInput): Promise<PreparedWorkspace> {
  const git = input.git ?? runGit;
  switch (input.strategy) {
    case "worktree":
      return prepareWorktree(input, git);
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
