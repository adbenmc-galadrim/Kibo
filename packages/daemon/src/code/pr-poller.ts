import type { GithubPrRef, PrInfo, TicketView } from "@kibo/schema";
import { call, type Service } from "../service";
import { attachPr, type Candidate, discoveryCandidates, findPr } from "./pr-discovery";
import { completeMerge, isFollowed, recordPr, triggerRules } from "./pr-rules";
import { prState } from "./remote-ops";
import type { Env } from "./run";

export type PrPoller = { stop(): void };
type Log = (what: string) => (e: unknown) => void;
type Tracked = { projectId: string; folder: string; ticket: TicketView; ref: GithubPrRef };

function trackedRefs(service: Service): Tracked[] {
  const tracked: Tracked[] = [];
  for (const project of call(service, { method: "listProjects" })) {
    const folder = project.folder;
    if (!folder) continue;
    for (const ticket of call(service, { method: "getProject", projectId: project.id }).tickets)
      for (const ref of ticket.externalRefs.filter(isFollowed))
        tracked.push({ projectId: project.id, folder, ticket, ref });
  }
  return tracked;
}

const changed = (ref: GithubPrRef, info: PrInfo): boolean =>
  ref.state !== info.state || ref.base !== info.base || ref.head !== info.head;

export function startPrPoller(service: Service, env: Env, intervalMs: number, log: Log): PrPoller {
  let stopped = false;
  let running = false;

  const update = async ({ projectId, folder, ticket, ref }: Tracked) => {
    const info = await prState(ref.url, folder, env);
    if (stopped || !changed(ref, info)) return;
    const next: GithubPrRef = { ...ref, state: info.state, base: info.base, head: info.head };
    recordPr(service, projectId, ticket.id, next);
    if (ref.state === "draft" && info.state === "open")
      triggerRules(service, projectId, { kind: "pr_opened", ticketId: ticket.id });
    if (info.state === "merged") completeMerge(service, projectId, ticket.id, next);
  };

  const discover = async (candidate: Candidate) => {
    const info = await findPr(candidate, env);
    if (!stopped && info) attachPr(service, candidate, info);
  };

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      for (const tracked of trackedRefs(service)) {
        if (stopped) return;
        await update(tracked).catch(log(`PR status failed for ${tracked.ref.url}`));
      }
      for (const candidate of discoveryCandidates(service)) {
        if (stopped) return;
        await discover(candidate).catch(log(`PR discovery failed for ${candidate.branch}`));
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void poll().catch(log("PR poll failed")), intervalMs);
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
