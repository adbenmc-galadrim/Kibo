import type { RuleTrigger } from "@kibo/core/rules";
import type { ExternalRef, GithubPrRef, TicketView } from "@kibo/schema";
import { call, type Service } from "../service";
import { prState } from "./remote-ops";
import type { Env } from "./run";

export type PrPoller = { stop(): void };
type Log = (what: string) => (e: unknown) => void;
type Tracked = { projectId: string; folder: string; ticket: TicketView; ref: GithubPrRef };

const isFollowed = (ref: ExternalRef): ref is GithubPrRef =>
  ref.kind === "github_pr" && (ref.state === "open" || ref.state === "draft");

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

export function triggerRules(service: Service, projectId: string, trigger: RuleTrigger): void {
  try {
    service.triggerRules(projectId, trigger);
  } catch (e) {
    console.error(`[kibo-daemon] rules ${trigger.kind} failed for ticket ${trigger.ticketId}`, e);
  }
}

export function startPrPoller(service: Service, env: Env, intervalMs: number, log: Log): PrPoller {
  let stopped = false;
  let running = false;

  const update = async ({ projectId, folder, ticket, ref }: Tracked) => {
    const info = await prState(ref.url, folder, env);
    if (stopped || info.state === ref.state) return;
    call(service, {
      method: "command",
      projectId,
      command: { method: "upsertExternalRef", ticketId: ticket.id, ref: { ...ref, state: info.state } },
    });
    if (ref.state === "draft" && info.state === "open")
      triggerRules(service, projectId, { kind: "pr_opened", ticketId: ticket.id });
    if (info.state === "merged") triggerRules(service, projectId, { kind: "pr_merged", ticketId: ticket.id });
  };

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      for (const tracked of trackedRefs(service)) {
        if (stopped) return;
        await update(tracked).catch(log(`PR status failed for ${tracked.ref.url}`));
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
