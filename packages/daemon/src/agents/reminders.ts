import { type HookPayload, type HookReply, MODIFYING_TOOLS, type RunView } from "@kibo/schema";
import type { HookSink } from "./hook-route";

export const PLAN_REMINDER =
  "Kibo : déclare ton plan avec mcp__kibo__ticket_progress avant de modifier des fichiers, puis tiens-le à jour à chaque étape.";
export const REPORT_REMINDER =
  "Kibo : remplis ton compte rendu avec mcp__kibo__ticket_progress (done, decisions, toCheck, files, next), puis termine.";

export type ReminderKind = "plan" | "report";

export type ReminderDeps = {
  run(runId: string): RunView | null;
  hasPlan(run: RunView): boolean;
  hasReport(run: RunView): boolean;
  moment(runId: string, kind: ReminderKind): void;
};

const isModification = (payload: HookPayload): boolean =>
  payload.event === "PreToolUse" && MODIFYING_TOOLS.includes(payload.tool ?? "");

function planReply(reply: HookReply | null): HookReply | null {
  if (reply?.kind === "stop") return null;
  if (reply?.decision === "deny") return null;
  return {
    kind: "permission",
    decision: "allow",
    reason: reply?.reason ?? "",
    additionalContext: PLAN_REMINDER,
  };
}

function reminderOf(
  deps: ReminderDeps,
  run: RunView,
  payload: HookPayload,
  reply: HookReply | null,
): { kind: ReminderKind; reply: HookReply } | null {
  if (isModification(payload)) {
    const reminded = deps.hasPlan(run) ? null : planReply(reply);
    return reminded ? { kind: "plan", reply: reminded } : null;
  }
  if (payload.event !== "Stop" || payload.stopHookActive || reply !== null || deps.hasReport(run))
    return null;
  return { kind: "report", reply: { kind: "stop", reason: REPORT_REMINDER } };
}

export function withReminders(sink: HookSink, deps: ReminderDeps): HookSink {
  const sent = new Map<string, Set<ReminderKind>>();
  const remind = (runId: string, payload: HookPayload, reply: HookReply | null): HookReply | null => {
    const run = deps.run(runId);
    if (run?.kind !== "ticket") return reply;
    const done = sent.get(runId) ?? new Set<ReminderKind>();
    const reminder = reminderOf(deps, run, payload, reply);
    if (!reminder || done.has(reminder.kind)) return reply;
    sent.set(runId, done.add(reminder.kind));
    try {
      deps.moment(runId, reminder.kind);
    } catch (e) {
      console.error(`[kibo-daemon] reminder moment of run ${runId} failed`, e);
    }
    return reminder.reply;
  };
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      return remind(runId, payload, sink.receive(runId, payload, toolInput));
    },
  };
}
