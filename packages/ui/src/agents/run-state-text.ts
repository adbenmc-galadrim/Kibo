import type { RunQuestions, RunView, WaitReason } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frAgentBar } from "../i18n/fr-agent-bar";
import { errorText } from "./format";

export function reasonText(reason: WaitReason | null): string {
  const r = frAgentBar.reasons;
  if (!reason) return r.next;
  switch (reason.kind) {
    case "paused":
      return r.paused;
    case "cpu":
      return r.cpu(reason.value, reason.threshold);
    case "ram":
      return r.ram(reason.value, reason.threshold);
    case "host":
      return r.host(reason.used, reason.total);
    case "agent":
      return r.agent(reason.agentName, reason.used, reason.total);
    case "agent_missing":
      return r.agentMissing;
    case "ticket_busy":
      return r.ticketBusy;
    case "parent_ticket":
      return r.parentTicket(reason.children);
  }
}

export function queueHint(run: RunView, reason: WaitReason | null): string {
  if (run.pendingAnswer === null || run.turns === 0) return reasonText(reason);
  return run.question === null ? fr.agents.messageHint : fr.agents.resumeHint;
}

export function runResultText(run: RunView, position: number | null): string {
  if (run.state === "queued" && position !== null) return fr.agents.position(position);
  if (run.state === "failed" && run.startedAt === null) return fr.agents.failedAtLaunch(errorText(run.error));
  if (run.state === "failed") return fr.agents.failedWith(errorText(run.error));
  return frAgentBar.states[run.state];
}

export function runStateText(
  run: RunView,
  questions: readonly RunQuestions[],
  position: number | null = null,
): { text: string; open: number } {
  const open = run.state === "done" ? (questions.find((q) => q.runId === run.id)?.open ?? 0) : 0;
  return { text: open > 0 ? frAgentBar.states.doneWithQuestions(open) : runResultText(run, position), open };
}
