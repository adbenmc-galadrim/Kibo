import { type CiRun, KiboError, type RepoSlug, type TicketView } from "@kibo/schema";
import { z } from "zod";
import type { GithubApi } from "../github/api";
import type { EventLog } from "../integrations/events";
import { githubRepoOf } from "../integrations/github-remote";
import type { IntegrationHost } from "../integrations/types";
import type { CiStore, StoredRun } from "./ci-store";
import { frCi } from "./fr";

export type CiPoller = {
  tick(): Promise<void>;
  runs(projectId: string, ticketId: string | null): Promise<CiRun[]>;
  start(): () => void;
};
type Deps = { host: IntegrationHost; api: GithubApi; store: CiStore; events: EventLog; connected(): boolean };
type LinkedPr = { number: number; ticket: TicketView };
type RemoteRun = z.infer<typeof Runs>["workflow_runs"][number];

const FAST_MS = 60_000;
const SLOW_MS = 15 * 60_000;
const FRESH_MS = 15 * 60_000;
const Pull = z.object({ head: z.object({ sha: z.string().min(1) }) });
const Runs = z.object({
  workflow_runs: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      head_sha: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      html_url: z.string().url().startsWith("https://github.com/"),
      run_started_at: z.string().nullable().optional(),
      updated_at: z.string(),
    }),
  ),
});
const Jobs = z.object({
  jobs: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      started_at: z.string().nullable(),
      completed_at: z.string().nullable(),
    }),
  ),
});

function linkedPrs(tickets: TicketView[], repo: RepoSlug): LinkedPr[] {
  const prefix = `https://github.com/${repo}/pull/`;
  return tickets.flatMap((ticket) =>
    ticket.externalRefs.flatMap((ref) =>
      ref.kind === "github_pr" && ref.url.startsWith(prefix) ? [{ number: ref.number, ticket }] : [],
    ),
  );
}

const storedRun = (projectId: string, repo: RepoSlug, pr: number, r: RemoteRun): StoredRun => ({
  repo,
  runId: r.id,
  projectId,
  headSha: r.head_sha,
  prNumber: pr,
  workflow: r.name,
  status: r.status,
  conclusion: r.conclusion,
  url: r.html_url,
  startedAt: r.run_started_at ?? null,
  updatedAt: r.updated_at,
  notified: false,
});

export function createCiPoller(deps: Deps): CiPoller {
  const { host, api, store, events } = deps;
  const lastPoll = new Map<string, number>();
  let running: Promise<void> | null = null;

  const syncJobs = async (repo: RepoSlug, runId: number) => {
    const { jobs } = await api.rest("GET", `/repos/${repo}/actions/runs/${runId}/jobs`, Jobs);
    store.upsertJobs(
      runId,
      jobs.map((j) => ({
        jobId: j.id,
        name: j.name,
        status: j.status,
        conclusion: j.conclusion,
        startedAt: j.started_at,
        completedAt: j.completed_at,
      })),
    );
  };

  const reportFailure = (projectId: string, repo: RepoSlug, pr: LinkedPr, r: RemoteRun, seen: string) => {
    if (r.status !== "completed" || r.conclusion !== "failure") return;
    const fresh = seen === "changed" || host.now() - Date.parse(r.updated_at) < FRESH_MS;
    const notified = store.runsOf(projectId, [pr.number]).find((x) => x.runId === r.id)?.notified;
    if (fresh && !notified) {
      host.notify({ title: frCi.failedTitle(pr.ticket.keyLabel), body: frCi.failedBody(r.name, pr.number) });
    }
    store.markNotified(repo, r.id);
  };

  const pollPr = async (projectId: string, repo: RepoSlug, pr: LinkedPr): Promise<boolean> => {
    const head = await api.rest("GET", `/repos/${repo}/pulls/${pr.number}`, Pull);
    const sha = encodeURIComponent(head.head.sha);
    const { workflow_runs } = await api.rest(
      "GET",
      `/repos/${repo}/actions/runs?head_sha=${sha}&per_page=20`,
      Runs,
    );
    let changed = false;
    for (const r of workflow_runs) {
      const seen = store.upsertRun(storedRun(projectId, repo, pr.number, r));
      if (seen === "same") continue;
      changed = true;
      await syncJobs(repo, r.id);
      reportFailure(projectId, repo, pr, r, seen);
    }
    return changed;
  };

  const pollProject = async (projectId: string) => {
    const repo = await githubRepoOf(host, projectId);
    if (!repo) return;
    const prs = linkedPrs(host.snapshot(projectId).tickets, repo);
    if (prs.length === 0) return;
    const active = prs.some((p) => p.ticket.statusId !== "done");
    const last = lastPoll.get(projectId);
    if (last !== undefined && host.now() - last < (active ? FAST_MS : SLOW_MS)) return;
    lastPoll.set(projectId, host.now());
    let changed = false;
    for (const pr of prs) if (await pollPr(projectId, repo, pr)) changed = true;
    if (changed) host.broadcast({ type: "ci", projectId });
  };

  const pollAll = async () => {
    for (const p of host.projects()) {
      try {
        await pollProject(p.id);
      } catch (e) {
        const k = e instanceof KiboError ? e : new KiboError("INTERNAL", String(e));
        events.log("github-actions", k.code === "RATE_LIMITED" ? "warn" : "error", `${p.id}: ${k.message}`);
      }
    }
  };

  const poller: CiPoller = {
    async tick() {
      if (!deps.connected()) return;
      if (running) return running;
      running = pollAll().finally(() => {
        running = null;
      });
      return running;
    },
    async runs(projectId, ticketId) {
      const repo = await githubRepoOf(host, projectId);
      if (!repo) return [];
      const prs = linkedPrs(host.snapshot(projectId).tickets, repo).filter(
        (p) => ticketId === null || p.ticket.id === ticketId,
      );
      const keyOf = new Map(prs.map((p) => [p.number, p.ticket.key]));
      const numbers = prs.map((p) => p.number);
      return store.runsOf(projectId, numbers).map(({ projectId: _project, notified: _notified, ...r }) => ({
        ...r,
        ticketKey: r.prNumber === null ? null : (keyOf.get(r.prNumber) ?? null),
        jobs: store.jobsOf(r.runId),
      }));
    },
    start() {
      const timer = setInterval(() => {
        poller.tick().catch((e: unknown) => events.log("github-actions", "error", String(e)));
      }, FAST_MS);
      return () => clearInterval(timer);
    },
  };
  return poller;
}
