import type { ExternalRef, TicketView } from "@kibo/schema";
import { call, type Service } from "../service";
import { prState } from "./remote-ops";
import type { Env } from "./run";

export type PrPoller = { stop(): void };
type Log = (what: string) => (e: unknown) => void;
type Tracked = { projectId: string; folder: string; ticket: TicketView; ref: ExternalRef };

const isFollowed = (ref: ExternalRef) =>
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
