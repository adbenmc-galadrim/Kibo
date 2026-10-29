import { NewRef, type PlanAction, type PlanOutcome, type PlanProblem } from "@kibo/schema";
import { frPlan } from "../fr-plan";

type Keys = Readonly<Record<string, string | null>>;
type Of<T extends PlanAction["type"]> = Extract<PlanAction, { type: T }>;

const t = frPlan.apply;

const refText = (ref: string, keys: Keys): string =>
  NewRef.safeParse(ref).success ? t.newRef(ref, keys[ref]) : ref;

function createText(a: Of<"createTicket">, keys: Keys): string {
  const what =
    a.feature === true
      ? t.createFeature(a.title)
      : a.parent !== undefined
        ? t.createStep(a.title, refText(a.parent, keys))
        : t.createTicket(a.title);
  return `${what}${t.createdKey(keys[a.ref])}`;
}

function updateText(a: Of<"updateTicket">, keys: Keys): string {
  const given = (["title", "description", "labels", "parent"] as const).filter((f) => a[f] !== undefined);
  return t.updateTicket(
    refText(a.ticket, keys),
    given.map((f) => t.fields[f]),
  );
}

const answerText = (a: Of<"answerQuestion">): string => a.answer.option ?? a.answer.text ?? a.answer.kind;

function describe(a: PlanAction, keys: Keys): string {
  const ref = (r: string) => refText(r, keys);
  switch (a.type) {
    case "createTicket":
      return createText(a, keys);
    case "updateTicket":
      return updateText(a, keys);
    case "setStatus":
      return t.setStatus(ref(a.ticket), a.statusId, a.blockedReason);
    case "setHold":
      return a.reason === null ? t.release(ref(a.ticket)) : t.hold(ref(a.ticket), a.reason);
    case "link":
      return t.link(ref(a.from), ref(a.to));
    case "unlink":
      return a.kind === "blocks" ? t.unlink(ref(a.from), ref(a.to)) : t.unrelate(ref(a.from), ref(a.to));
    case "createSprint":
      return t.createSprint(a.code, a.name, a.start, a.end);
    case "setSprint":
      return a.sprint === null ? t.clearSprint(ref(a.ticket)) : t.setSprint(a.sprint, ref(a.ticket));
    case "createQuestion":
      return t.createQuestion(a.title, ref(a.ticket));
    case "answerQuestion":
      return t.answerQuestion(a.questionId, answerText(a));
    case "updateQuestion":
      return t.updateQuestion(a.questionId);
    case "reopenQuestion":
      return t.reopenQuestion(a.questionId);
    case "deleteQuestion":
      return t.deleteQuestion(a.questionId);
    case "addRecipient":
      return t.addRecipient(a.name);
  }
}

const byId = (actions: readonly PlanAction[]): PlanAction[] => [...actions].sort((a, b) => a.id - b.id);

export function previewLines(actions: readonly PlanAction[], keys: Keys): string[] {
  return byId(actions).map((a) => t.line(a.id, describe(a, keys)));
}

function appliedText(a: PlanAction, keys: Keys): string {
  const key = a.type === "createTicket" ? keys[a.ref] : undefined;
  return a.type === "createTicket" && typeof key === "string" ? t.created(key, a.title) : describe(a, keys);
}

export function outcomeLines(actions: readonly PlanAction[], outcome: PlanOutcome): string[] {
  const keys: Keys = Object.fromEntries(outcome.created.map((c) => [c.ref, c.key]));
  const actionOf = new Map(actions.map((a) => [a.id, a]));
  const lines = outcome.results.flatMap((r) => {
    const a = actionOf.get(r.actionId);
    if (a === undefined) return [];
    if (r.outcome === "applied") return [t.applied(a.id, appliedText(a, keys))];
    if (r.outcome === "skipped") return [t.skipped(a.id, r.detail)];
    return [t.failed(a.id, describe(a, keys), r.detail)];
  });
  if (outcome.created.length > 0) lines.push(t.createdList(outcome.created));
  if (outcome.stoppedAt !== null) lines.push(t.stoppedAt(outcome.stoppedAt));
  return lines;
}

export function problemLines(problems: readonly PlanProblem[]): string[] {
  return problems.map((p) => t.problem(p.actionId, p.type, p.message));
}
