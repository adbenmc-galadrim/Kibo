import {
  type HookPayload,
  type HookReply,
  MODIFYING_TOOLS,
  type ReminderKind,
  type RunView,
} from "@kibo/schema";
import type { HookSink } from "./hook-route";

export const PLAN_REMINDER =
  "Kibo : déclare ton plan avec mcp__kibo__ticket_progress avant de modifier des fichiers, puis tiens-le à jour à chaque étape.";
export const REPORT_REMINDER =
  "Kibo : remplis ton compte rendu avec mcp__kibo__ticket_progress (done, decisions, toCheck, files, next), puis termine.";

export const SKILLS_REMINDER =
  "Kibo : laisse ta review des skills utilisés avec mcp__kibo__skill_review (ok ou improve, une note de trois lignes au plus, la suggestion complète si tu proposes une modification), puis termine.";
export const REPORT_SKILLS_REMINDER =
  "Kibo : remplis ton compte rendu avec mcp__kibo__ticket_progress et laisse ta review des skills utilisés avec mcp__kibo__skill_review, puis termine.";

export type { ReminderKind } from "@kibo/schema";

export type ReminderDeps = {
  run(runId: string): RunView | null;
  hasPlan(run: RunView): boolean;
  hasReport(run: RunView): boolean;
  usedSkills(runId: string): number;
  hasSkillReview(runId: string): boolean;
  moment(runId: string, kind: ReminderKind): void;
};

const STOP_REASONS: Record<Exclude<ReminderKind, "plan">, string> = {
  report: REPORT_REMINDER,
  skills: SKILLS_REMINDER,
  report_skills: REPORT_SKILLS_REMINDER,
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
  if (payload.event !== "Stop" || payload.stopHookActive || reply !== null) return null;
  const kind = stopKind(!deps.hasReport(run), deps.usedSkills(run.id) > 0 && !deps.hasSkillReview(run.id));
  return kind ? { kind, reply: { kind: "stop", reason: STOP_REASONS[kind] } } : null;
}

function stopKind(report: boolean, skills: boolean): Exclude<ReminderKind, "plan"> | null {
  if (report && skills) return "report_skills";
  if (report) return "report";
  return skills ? "skills" : null;
}

type SentKey = "plan" | "stop";
const sentKey = (kind: ReminderKind): SentKey => (kind === "plan" ? "plan" : "stop");

export type ReminderSink = HookSink & { forget(runId: string): void };

const logFailure = (what: string, runId: string) => (e: unknown) =>
  console.error(`[kibo-daemon] ${what} of run ${runId} failed`, e);

function attempt<T>(fn: () => T, onError: (e: unknown) => void): T | null {
  try {
    return fn();
  } catch (e) {
    onError(e);
    return null;
  }
}

export function withReminders(sink: HookSink, deps: ReminderDeps): ReminderSink {
  const sent = new Map<string, Set<SentKey>>();
  const remind = (runId: string, payload: HookPayload, reply: HookReply | null): HookReply | null => {
    const run = attempt(() => deps.run(runId), logFailure("reminder lookup", runId));
    if (run?.kind !== "ticket") return reply;
    const done = sent.get(runId) ?? new Set<SentKey>();
    const reminder = attempt(() => reminderOf(deps, run, payload, reply), logFailure("reminder", runId));
    if (!reminder || done.has(sentKey(reminder.kind))) return reply;
    sent.set(runId, done.add(sentKey(reminder.kind)));
    attempt(() => deps.moment(runId, reminder.kind), logFailure("reminder moment", runId));
    return reminder.reply;
  };
  return {
    verify: (runId, token) => sink.verify(runId, token),
    receive(runId, payload, toolInput) {
      return remind(runId, payload, sink.receive(runId, payload, toolInput));
    },
    forget: (runId) => {
      sent.delete(runId);
    },
  };
}
