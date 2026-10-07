import { GhLogin, type GhStatus, KiboError, PrInfo } from "@kibo/schema";
import { currentBranch, pushRemote, remoteBranches } from "./read";
import type { WorktreeHandle } from "./repo";
import { type Env, firstLine, NETWORK_TIMEOUT_MS, type RunResult, runGh } from "./run";

export type CreatePrInput = {
  title: string;
  body: string;
  base: string;
  draft: boolean;
  reviewers: string[];
};

const PR_FIELDS = ["--json", "number,url,state,isDraft,baseRefName,headRefName"];
const PR_URL = /^https:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+\/pull\/\d+$/;
const NO_PR = /no (open )?pull requests? found/i;

const field = (data: unknown, key: string): unknown =>
  typeof data === "object" && data !== null ? Reflect.get(data, key) : undefined;

function ghFailure(r: RunResult, action: string): KiboError {
  return new KiboError("GH_FAILED", firstLine(r.stderr) || `gh ${action} failed`);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new KiboError("GH_FAILED", `gh returned invalid JSON: ${String(e)}`);
  }
}

function toState(data: unknown): string {
  const state = field(data, "state");
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return field(data, "isDraft") === true ? "draft" : "open";
}

export function toPrInfo(raw: string): PrInfo {
  const data = parseJson(raw);
  const parsed = PrInfo.safeParse({
    number: field(data, "number"),
    url: field(data, "url"),
    state: toState(data),
    base: field(data, "baseRefName") ?? null,
    head: field(data, "headRefName") ?? null,
  });
  if (!parsed.success) throw new KiboError("GH_FAILED", "unexpected gh output");
  return parsed.data;
}

async function branchOf(h: WorktreeHandle): Promise<string> {
  const branch = await currentBranch(h);
  if (!branch) throw new KiboError("INVALID_INPUT", "HEAD is detached");
  return branch;
}

export async function push(h: WorktreeHandle): Promise<void> {
  const branch = await branchOf(h);
  const remote = await pushRemote(h, branch);
  if (!remote) throw new KiboError("GIT_FAILED", "no remote configured");
  await h.git.ok(["push", "--porcelain", "-u", remote, `refs/heads/${branch}:refs/heads/${branch}`], {
    timeoutMs: NETWORK_TIMEOUT_MS,
  });
}

export async function ghStatus(h: WorktreeHandle): Promise<GhStatus> {
  try {
    const r = await runGh(["auth", "status"], { cwd: h.path, env: h.env });
    return r.code === 0
      ? { available: true, detail: null }
      : { available: false, detail: firstLine(r.stderr) || null };
  } catch (e) {
    if (e instanceof KiboError && e.code === "GH_UNAVAILABLE") return { available: false, detail: e.detail };
    throw e;
  }
}

export async function prForBranch(h: WorktreeHandle): Promise<PrInfo | null> {
  const branch = await currentBranch(h);
  if (!branch) return null;
  const r = await runGh(["pr", "view", branch, ...PR_FIELDS], { cwd: h.path, env: h.env });
  if (r.code === 0) return toPrInfo(r.stdout);
  if (NO_PR.test(r.stderr)) return null;
  throw ghFailure(r, "pr view");
}

export async function prState(url: string, cwd: string, env: Env): Promise<PrInfo> {
  if (!PR_URL.test(url)) throw new KiboError("INVALID_INPUT", `${url} is not a pull request URL`);
  const r = await runGh(["pr", "view", url, ...PR_FIELDS], { cwd, env });
  if (r.code !== 0) throw ghFailure(r, "pr view");
  return toPrInfo(r.stdout);
}

function assertReviewers(reviewers: string[]): void {
  const invalid = reviewers.find((r) => !GhLogin.safeParse(r).success);
  if (invalid !== undefined) throw new KiboError("INVALID_INPUT", `${invalid} is not a GitHub login`);
}

async function assertBase(h: WorktreeHandle, base: string): Promise<void> {
  const { branches } = await remoteBranches(h);
  if (!branches.includes(base)) throw new KiboError("INVALID_INPUT", `${base} is not a branch of the remote`);
}

function createArgs(branch: string, input: CreatePrInput): string[] {
  return [
    "pr",
    "create",
    `--head=${branch}`,
    `--base=${input.base}`,
    `--title=${input.title}`,
    "--body-file",
    "-",
    ...(input.draft ? ["--draft"] : []),
    ...(input.reviewers.length ? [`--reviewer=${input.reviewers.join(",")}`] : []),
  ];
}

function createdPr(stdout: string, branch: string, input: CreatePrInput): PrInfo {
  const url = stdout.trim().split("\n").at(-1)?.trim() ?? "";
  const m = /\/pull\/(\d+)$/.exec(url);
  const parsed = PrInfo.safeParse({
    number: Number(m?.[1]),
    url,
    state: input.draft ? "draft" : "open",
    base: input.base,
    head: branch,
  });
  if (!m || !parsed.success) throw new KiboError("GH_FAILED", `unexpected gh output: ${url}`);
  return parsed.data;
}

export async function createPr(h: WorktreeHandle, input: CreatePrInput): Promise<PrInfo> {
  assertReviewers(input.reviewers);
  const branch = await branchOf(h);
  await assertBase(h, input.base);
  await push(h);
  const r = await runGh(createArgs(branch, input), { cwd: h.path, env: h.env, stdin: input.body });
  if (r.code !== 0) throw ghFailure(r, "pr create");
  return createdPr(r.stdout, branch, input);
}
