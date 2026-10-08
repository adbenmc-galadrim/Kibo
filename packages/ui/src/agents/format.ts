import type { RunQuestions, RunView, WaitReason } from "@kibo/schema";
import { fr } from "../i18n/fr";

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
const ERRORS: Record<string, string> = fr.agents.errors;

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 10_000) return `${oneDecimal(n / 1_000)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
  return `${oneDecimal(n / 1_000_000)}M`;
}

export function formatGb(n: number): string {
  return oneDecimal(n);
}

export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function elapsed(run: RunView, now: number): number {
  return run.activeMs + (run.turnStartedAt === null ? 0 : Math.max(0, now - run.turnStartedAt));
}

export function reasonText(reason: WaitReason | null): string {
  const r = fr.agents.reasons;
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
    case "profile":
      return r.profile(reason.profileName, reason.used, reason.total);
    case "profile_missing":
      return r.profileMissing;
    case "ticket_busy":
      return r.ticketBusy;
  }
}

export function queueHint(run: RunView, reason: WaitReason | null): string {
  if (run.pendingAnswer === null || run.turns === 0) return reasonText(reason);
  return run.question === null ? fr.queue.messageHint : fr.queue.resumeHint;
}

export function workspaceText(label: string | null): string {
  if (!label) return "";
  if (label.startsWith("worktree:")) return fr.agents.workspace.worktree(label.slice("worktree:".length));
  if (label === "repo") return fr.agents.workspace.repo;
  if (label === "isolated") return fr.agents.workspace.isolated;
  return label;
}

export function errorText(error: string | null): string {
  if (!error) return "";
  const code = /^([A-Z_]+):/.exec(error)?.[1];
  return (code && ERRORS[code]) || error;
}

export function runResultText(run: RunView, position: number | null): string {
  if (run.state === "queued" && position !== null) return fr.agents.position(position);
  if (run.state === "failed") return fr.agents.failedWith(errorText(run.error));
  return fr.agents.states[run.state];
}

export function runStateText(
  run: RunView,
  questions: readonly RunQuestions[],
  position: number | null = null,
): { text: string; open: number } {
  const open = run.state === "done" ? (questions.find((q) => q.runId === run.id)?.open ?? 0) : 0;
  return { text: open > 0 ? fr.agents.states.doneWithQuestions(open) : runResultText(run, position), open };
}
