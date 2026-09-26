import type { Database } from "bun:sqlite";
import { type CiJobSummary, type CiRun, RepoSlug } from "@kibo/schema";

export type StoredRun = Omit<CiRun, "ticketKey" | "jobs"> & { projectId: string; notified: boolean };
export type StoredJob = { repo: RepoSlug; completed: boolean; logPath: string | null; truncated: boolean };
export type StoredLog = { path: string; at: number; truncated: boolean };

type RunRow = {
  repo: string;
  run_id: number;
  project_id: string;
  head_sha: string;
  pr_number: number | null;
  workflow: string;
  status: string;
  conclusion: string | null;
  url: string;
  started_at: string | null;
  updated_at: string;
  notified: number;
};
type JobRow = {
  job_id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
};
type JobLogRow = { repo: string; status: string; log_path: string | null; log_truncated: number };

const toRun = (r: RunRow): StoredRun => ({
  repo: RepoSlug.parse(r.repo),
  runId: r.run_id,
  projectId: r.project_id,
  headSha: r.head_sha,
  prNumber: r.pr_number,
  workflow: r.workflow,
  status: r.status,
  conclusion: r.conclusion,
  url: r.url,
  startedAt: r.started_at,
  updatedAt: r.updated_at,
  notified: r.notified === 1,
});

const toJob = (j: JobRow): CiJobSummary => ({
  jobId: j.job_id,
  name: j.name,
  status: j.status,
  conclusion: j.conclusion,
  startedAt: j.started_at,
  completedAt: j.completed_at,
});

function queries(db: Database) {
  return {
    run: db.query<RunRow, { repo: string; id: number }>(
      "SELECT * FROM ci_runs WHERE repo = $repo AND run_id = $id",
    ),
    upsertRun: db.query(
      "INSERT INTO ci_runs (repo, run_id, project_id, head_sha, head_branch, pr_number, workflow, status, conclusion, url, started_at, updated_at, notified) VALUES ($repo, $id, $project, $sha, NULL, $pr, $workflow, $status, $conclusion, $url, $started, $updated, $notified) ON CONFLICT(repo, run_id) DO UPDATE SET status = excluded.status, conclusion = excluded.conclusion, updated_at = excluded.updated_at, pr_number = excluded.pr_number",
    ),
    runsOfProject: db.query<RunRow, { project: string }>(
      "SELECT * FROM ci_runs WHERE project_id = $project ORDER BY updated_at DESC, run_id DESC",
    ),
    jobs: db.query<JobRow, { run: number }>("SELECT * FROM ci_jobs WHERE run_id = $run ORDER BY job_id"),
    upsertJob: db.query(
      "INSERT INTO ci_jobs (run_id, job_id, name, status, conclusion, started_at, completed_at, steps_json) VALUES ($run, $job, $name, $status, $conclusion, $started, $completed, '[]') ON CONFLICT(job_id) DO UPDATE SET status = excluded.status, conclusion = excluded.conclusion, started_at = excluded.started_at, completed_at = excluded.completed_at",
    ),
    notified: db.query("UPDATE ci_runs SET notified = 1 WHERE repo = $repo AND run_id = $id"),
    job: db.query<JobLogRow, { project: string; run: number; job: number }>(
      "SELECT r.repo AS repo, j.status AS status, j.log_path AS log_path, j.log_truncated AS log_truncated FROM ci_jobs j JOIN ci_runs r ON r.run_id = j.run_id WHERE r.project_id = $project AND j.run_id = $run AND j.job_id = $job",
    ),
    setLog: db.query(
      "UPDATE ci_jobs SET log_path = $path, log_fetched_at = $at, log_truncated = $truncated WHERE job_id = $job",
    ),
    stale: db.query<{ job_id: number; log_path: string }, { before: number }>(
      "SELECT job_id, log_path FROM ci_jobs WHERE log_path IS NOT NULL AND log_fetched_at < $before",
    ),
  };
}

export function createCiStore(db: Database) {
  const q = queries(db);
  return {
    upsertRun(r: StoredRun): "new" | "changed" | "same" {
      const prev = q.run.get({ repo: r.repo, id: r.runId });
      q.upsertRun.run({
        repo: r.repo,
        id: r.runId,
        project: r.projectId,
        sha: r.headSha,
        pr: r.prNumber,
        workflow: r.workflow,
        status: r.status,
        conclusion: r.conclusion,
        url: r.url,
        started: r.startedAt,
        updated: r.updatedAt,
        notified: r.notified ? 1 : 0,
      });
      if (!prev) return "new";
      return prev.updated_at === r.updatedAt && prev.status === r.status ? "same" : "changed";
    },
    upsertJobs(runId: number, jobs: CiJobSummary[]): void {
      for (const j of jobs) {
        q.upsertJob.run({
          run: runId,
          job: j.jobId,
          name: j.name,
          status: j.status,
          conclusion: j.conclusion,
          started: j.startedAt,
          completed: j.completedAt,
        });
      }
    },
    runsOf(projectId: string, prNumbers: number[] | null): StoredRun[] {
      const all = q.runsOfProject.all({ project: projectId }).map(toRun);
      if (prNumbers === null) return all;
      return all.filter((r) => r.prNumber !== null && prNumbers.includes(r.prNumber));
    },
    jobsOf: (runId: number): CiJobSummary[] => q.jobs.all({ run: runId }).map(toJob),
    markNotified(repo: string, runId: number): void {
      q.notified.run({ repo, id: runId });
    },
    job(projectId: string, runId: number, jobId: number): StoredJob | null {
      const r = q.job.get({ project: projectId, run: runId, job: jobId });
      if (!r) return null;
      return {
        repo: RepoSlug.parse(r.repo),
        completed: r.status === "completed",
        logPath: r.log_path,
        truncated: r.log_truncated === 1,
      };
    },
    setLog(jobId: number, log: StoredLog | null): void {
      q.setLog.run({
        job: jobId,
        path: log?.path ?? null,
        at: log?.at ?? null,
        truncated: log?.truncated ? 1 : 0,
      });
    },
    staleLogs: (before: number): { jobId: number; path: string }[] =>
      q.stale.all({ before }).map((r) => ({ jobId: r.job_id, path: r.log_path })),
  };
}
export type CiStore = ReturnType<typeof createCiStore>;
