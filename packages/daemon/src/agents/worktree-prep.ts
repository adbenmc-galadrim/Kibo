import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import {
  branchSlug,
  type GitBranchRef,
  isGitBranchName,
  KiboError,
  renderTemplate,
  resolveWorktreePath,
  splitRemote,
  TicketKey,
  WORKTREE_DEFAULTS,
  WorktreeSettings,
  type WorktreeVars,
} from "@kibo/schema";
import { runBounded } from "./bounded-process";
import { cleanEnv } from "./runner";
import type { GitRunner, PreparedWorkspace } from "./workspace-prep";

export type ShellRunner = (
  command: string,
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
) => Promise<{ code: number; output: string; timedOut: boolean }>;
export type WorktreeInput = {
  root: string;
  ticketKey: string;
  branchRef: GitBranchRef | null;
  settings: WorktreeSettings;
  runDir: string;
  git: GitRunner;
  shell: ShellRunner;
};

export const SETUP_TIMEOUT_MS = 600_000;
export const FETCH_TIMEOUT_MS = 60_000;
const TAIL_LINES = 20;
const SAMPLE_VARS: WorktreeVars = { branch: "feat/x", slug: "feat-x", key: "key-1", path: "/repo-feat-x" };

const failed = (detail: string) => new KiboError("WORKSPACE_FAILED", detail);
const gitFailed = (detail: string) => new KiboError("GIT_FAILED", detail);

export function worktreeBranch(ticketKey: string, branchRef: GitBranchRef | null): string {
  if (branchRef) return branchRef.branch;
  const parsed = TicketKey.safeParse(ticketKey);
  if (!parsed.success) throw failed(`invalid ticket key ${JSON.stringify(ticketKey)}`);
  return parsed.data.toLowerCase();
}

export const worktreeBase = (settings: WorktreeSettings, branchRef: GitBranchRef | null): string =>
  branchRef?.base ?? settings.baseRef;

export function assertWorktreeSettings(settings: WorktreeSettings): void {
  resolveWorktreePath("/repo", settings.pathTemplate, SAMPLE_VARS);
  if (settings.setup !== null) renderTemplate(settings.setup, SAMPLE_VARS);
}

export const runShell: ShellRunner = async (command, cwd, env, timeoutMs) => {
  const res = await runBounded(["sh", "-c", command], { cwd, env, timeoutMs });
  return { code: res.code, output: `${res.stdout}${res.stderr}`, timedOut: res.timedOut };
};

const tail = (output: string) => output.trim().split("\n").slice(-TAIL_LINES).join("\n");
const envRef = (name: string) => "$".concat("{", name, "}");
const ENV_REFS: Required<WorktreeVars> = {
  branch: envRef("KIBO_BRANCH"),
  slug: envRef("KIBO_SLUG"),
  key: envRef("KIBO_KEY"),
  path: envRef("KIBO_PATH"),
};
const looksLikeOption = (name: string) => name.split("/").some((part) => part.startsWith("-"));

async function commonDir(path: string, git: GitRunner): Promise<string | null> {
  const res = await git(["rev-parse", "--path-format=absolute", "--git-common-dir"], path);
  return res.code === 0 ? realpathSync(res.stdout.trim()) : null;
}

async function assertWorktreeOf(path: string, root: string, git: GitRunner): Promise<void> {
  const own = await git(["rev-parse", "--show-toplevel"], path);
  if (own.code !== 0 || realpathSync(own.stdout.trim()) !== realpathSync(path))
    throw gitFailed(`${path} exists but is not a worktree`);
  const [mine, theirs] = await Promise.all([commonDir(root, git), commonDir(path, git)]);
  if (mine === null || mine !== theirs) throw gitFailed(`${path} is not a worktree of ${root}`);
}

async function branchAt(path: string, git: GitRunner): Promise<string> {
  const res = await git(["rev-parse", "--abbrev-ref", "HEAD"], path);
  return res.code === 0 ? res.stdout.trim() : "";
}

const hasLocalBranch = async (root: string, branch: string, git: GitRunner) =>
  (await git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], root)).code === 0;

async function startPoint(root: string, base: string, git: GitRunner): Promise<string> {
  const { remote, branch } = splitRemote(base);
  const remotes = remote === null ? [] : (await git(["remote"], root)).stdout.split("\n");
  if (remote !== null && remotes.includes(remote)) {
    const fetched = await git(["fetch", "--quiet", "--", remote, branch], root, FETCH_TIMEOUT_MS);
    if (fetched.code !== 0) throw gitFailed(`git fetch ${remote} ${branch} failed: ${fetched.stderr.trim()}`);
    return base;
  }
  if (await hasLocalBranch(root, base, git)) return base;
  if (remote !== null) throw gitFailed(`remote ${remote} not found`);
  if (base === WORKTREE_DEFAULTS.baseRef) return "HEAD";
  throw gitFailed(`base branch ${base} not found`);
}

async function ensureBranch(root: string, branch: string, base: string, git: GitRunner): Promise<void> {
  if (await hasLocalBranch(root, branch, git)) return;
  const start = await startPoint(root, base, git);
  const created = await git(["branch", "--no-track", branch, start], root);
  if (created.code !== 0) throw gitFailed(`git branch ${branch} failed: ${created.stderr.trim()}`);
}

async function excludeKiboFolder(root: string, git: GitRunner): Promise<void> {
  const res = await git(["rev-parse", "--git-path", "info/exclude"], root);
  if (res.code !== 0) throw gitFailed(`cannot locate info/exclude: ${res.stderr.trim()}`);
  const relative = res.stdout.trim();
  const file = isAbsolute(relative) ? relative : join(root, relative);
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (current.split("\n").includes(".kibo/")) return;
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${current.length > 0 && !current.endsWith("\n") ? "\n" : ""}.kibo/\n`);
}

function setupCommand(setup: string): string {
  try {
    return renderTemplate(setup, ENV_REFS);
  } catch (e) {
    throw failed(e instanceof KiboError ? e.detail : String(e));
  }
}

async function runSetup(input: WorktreeInput, setup: string, vars: Required<WorktreeVars>): Promise<void> {
  const command = setupCommand(setup);
  const env = {
    ...cleanEnv(process.env),
    KIBO_BRANCH: vars.branch,
    KIBO_SLUG: vars.slug,
    KIBO_KEY: vars.key,
    KIBO_PATH: vars.path,
    KIBO_WORKTREE: vars.path,
    KIBO_TICKET: input.ticketKey,
  };
  const result = await input.shell(command, input.root, env, SETUP_TIMEOUT_MS);
  mkdirSync(input.runDir, { recursive: true, mode: 0o700 });
  const values = `KIBO_BRANCH=${vars.branch} KIBO_PATH=${vars.path}`;
  writeFileSync(join(input.runDir, "setup.log"), `$ ${command}\n# ${values}\n${result.output}`, {
    mode: 0o600,
  });
  if (result.timedOut) throw new KiboError("TIMEOUT", `setup command exceeded ${SETUP_TIMEOUT_MS / 1000}s`);
  if (result.code !== 0) throw failed(`setup command exited with ${result.code}:\n${tail(result.output)}`);
  if (!existsSync(vars.path))
    throw failed(`setup did not create a worktree at ${vars.path}:\n${tail(result.output)}`);
}

async function addWorktree(input: WorktreeInput, vars: Required<WorktreeVars>): Promise<void> {
  const setup = input.settings.setup;
  if (setup !== null) return runSetup(input, setup, vars);
  const added = await input.git(["worktree", "add", vars.path, vars.branch], input.root);
  if (added.code !== 0) throw gitFailed(`git worktree add failed: ${added.stderr.trim()}`);
}

function realLocation(path: string): string {
  const rest: string[] = [];
  let at = path;
  while (!existsSync(at)) {
    rest.unshift(basename(at));
    at = dirname(at);
  }
  return join(realpathSync(at), ...rest);
}

function assertInsideRepo(root: string, path: string): void {
  const realRoot = realpathSync(root);
  const real = realLocation(path);
  const below = real.startsWith(realRoot + sep);
  const beside = dirname(real) === dirname(realRoot) && real !== realRoot;
  if (!below && !beside) throw failed(`worktree path ${path} resolves to ${real}, outside the repository`);
}

function worktreePath(input: WorktreeInput, vars: WorktreeVars): string {
  try {
    return resolveWorktreePath(input.root, input.settings.pathTemplate, vars);
  } catch (e) {
    throw failed(e instanceof KiboError ? e.detail : String(e));
  }
}

export async function prepareWorktree(input: WorktreeInput): Promise<PreparedWorkspace> {
  const branch = worktreeBranch(input.ticketKey, input.branchRef);
  const base = worktreeBase(input.settings, input.branchRef);
  if (!isGitBranchName(branch) || looksLikeOption(branch))
    throw failed(`invalid branch name ${JSON.stringify(branch)}`);
  if (!WorktreeSettings.shape.baseRef.safeParse(base).success || looksLikeOption(base))
    throw failed(`invalid base ${JSON.stringify(base)}`);
  const named = { branch, slug: branchSlug(branch), key: input.ticketKey.toLowerCase() };
  const vars = { ...named, path: worktreePath(input, named) };
  const label = `worktree:${branch}`;
  if (input.settings.pathTemplate.startsWith(".kibo/")) await excludeKiboFolder(input.root, input.git);
  assertInsideRepo(input.root, vars.path);
  if (existsSync(vars.path)) {
    await assertWorktreeOf(vars.path, input.root, input.git);
    return { cwd: vars.path, label };
  }
  await ensureBranch(input.root, branch, base, input.git);
  await addWorktree(input, vars);
  try {
    await assertWorktreeOf(vars.path, input.root, input.git);
  } catch (e) {
    throw failed(`setup did not create a worktree at ${vars.path}: ${e instanceof KiboError ? e.detail : e}`);
  }
  const actual = await branchAt(vars.path, input.git);
  if (actual !== branch) throw failed(`worktree is on ${actual}, expected ${branch}`);
  return { cwd: vars.path, label };
}
