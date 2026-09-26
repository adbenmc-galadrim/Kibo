import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CiLog, githubError, KiboError } from "@kibo/schema";
import type { GithubApi } from "../github/api";
import { GITHUB_LOG_RULES } from "../integrations/net";
import type { IntegrationHost } from "../integrations/types";
import type { CiStore } from "./ci-store";

export const MAX_LOG_BYTES = 20 * 1024 * 1024;
export const LOG_RETENTION_MS = 14 * 24 * 3_600_000;
export type CiLogDeps = {
  host: IntegrationHost;
  api: GithubApi;
  store: CiStore;
  redact(text: string): string;
};

const ERROR_LINE = /##\[error\]|\b(error|fatal|failed)\b/i;

export function errorLinesOf(text: string): number[] {
  return text.split("\n").flatMap((line, i) => (ERROR_LINE.test(line) ? [i + 1] : []));
}

const toLog = (text: string, truncated: boolean): CiLog => ({
  text,
  truncated,
  errorLines: errorLinesOf(text),
});

function wholeLines(text: string, truncated: boolean): string {
  return truncated ? text.slice(0, text.lastIndexOf("\n") + 1) : text;
}

function cache(deps: CiLogDeps, runId: number, jobId: number, text: string, truncated: boolean): void {
  const path = join(deps.host.home, "cache", "ci", String(runId), `${jobId}.log`);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, text, { mode: 0o600 });
  chmodSync(path, 0o600);
  deps.store.setLog(jobId, { path, at: deps.host.now(), truncated });
}

export async function readCiLog(
  deps: CiLogDeps,
  projectId: string,
  runId: number,
  jobId: number,
): Promise<CiLog> {
  const job = deps.store.job(projectId, runId, jobId);
  if (!job) throw new KiboError("NOT_FOUND", `ci job ${jobId} not found`);
  if (job.logPath && existsSync(job.logPath)) {
    return toLog(deps.redact(readFileSync(job.logPath, "utf8")), job.truncated);
  }
  const res = await deps.api.raw(
    `/repos/${job.repo}/actions/jobs/${jobId}/logs`,
    GITHUB_LOG_RULES,
    MAX_LOG_BYTES,
  );
  const raw = new TextDecoder().decode(res.body, { stream: res.truncated });
  if (res.status < 200 || res.status >= 300) throw githubError(res.status, (n) => res.headers.get(n), raw);
  const text = deps.redact(wholeLines(raw, res.truncated));
  if (job.completed) cache(deps, runId, jobId, text, res.truncated);
  return toLog(text, res.truncated);
}

export function purgeCiLogs(deps: Pick<CiLogDeps, "store">, now: number): void {
  for (const { jobId, path } of deps.store.staleLogs(now - LOG_RETENTION_MS)) {
    rmSync(path, { force: true });
    deps.store.setLog(jobId, null);
  }
}
