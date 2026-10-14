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

export type ReminderDeps = {
  run(runId: string): RunView | null;
  hasPlan(run: RunView): boolean;
  hasReport(run: RunView): boolean;
  usedSkills(runId: string): number;
  hasSkillReview(runId: string): boolean;
  moment(runId: string, kind: ReminderKind): void;
};

type StopKind = Exclude<ReminderKind, "plan" | "overlap">;

const STOP_REASONS: Record<StopKind, string> = {
  report: REPORT_REMINDER,
  skills: SKILLS_REMINDER,
  report_skills: REPORT_SKILLS_REMINDER,
};

const isModification = (payload: HookPayload): boolean =>
  payload.event === "PreToolUse" && MODIFYING_TOOLS.includes(payload.tool ?? "");

type SentKey = "plan" | "stop";
type Reminder = { kind: ReminderKind; key: SentKey; reply: HookReply };

function planReminder(deps: ReminderDeps, run: RunView, reply: HookReply | null, done: Set<SentKey>) {
  if (done.has("plan") || deps.hasPlan(run)) return null;
  if (reply?.kind === "stop" || reply?.decision === "deny") return null;
  const additionalContext = [reply?.additionalContext, PLAN_REMINDER].filter(Boolean).join("\n\n");
  const reminded: HookReply = {
    kind: "permission",
    decision: "allow",
    reason: reply?.reason ?? "",
    additionalContext,
  };
  return { kind: "plan", key: "plan", reply: reminded } satisfies Reminder;
}

function stopKind(report: boolean, skills: boolean): StopKind | null {
  if (report) return skills ? "report_skills" : "report";
  return skills ? "skills" : null;
}

function stopReminder(deps: ReminderDeps, run: RunView, done: Set<SentKey>): Reminder | null {
  if (done.has("stop")) return null;
  const usedSkills = deps.usedSkills(run.id) > 0 && !deps.hasSkillReview(run.id);
  const kind = stopKind(!deps.hasReport(run), usedSkills);
  return kind && { kind, key: "stop", reply: { kind: "stop", reason: STOP_REASONS[kind] } };
}

function reminderOf(
  deps: ReminderDeps,
  run: RunView,
  payload: HookPayload,
  reply: HookReply | null,
  done: Set<SentKey>,
): Reminder | null {
  if (isModification(payload)) return planReminder(deps, run, reply, done);
  if (payload.event !== "Stop" || payload.stopHookActive || reply !== null) return null;
  return stopReminder(deps, run, done);
}

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
    const reminder = attempt(
      () => reminderOf(deps, run, payload, reply, done),
      logFailure("reminder", runId),
    );
    if (!reminder) return reply;
    sent.set(runId, done.add(reminder.key));
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
