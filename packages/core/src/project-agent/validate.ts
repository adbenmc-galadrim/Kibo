import {
  type ActionType,
  ANSWER_TEXT_MAX,
  type AnswerInput,
  answersToDeliver,
  type Batch,
  type ExpectedState,
  isTerminal,
  type ProposeBatchInput,
  type ProposedAction,
  type Question,
} from "@kibo/schema";
import { type BatchContext, captureExpected, ticketByKey, ticketRuns } from "./expected";
import { assignableAgents } from "./overview";
import { isNewRef, signalRefsOf, ticketRefsOf } from "./refs";
import { answerQuestionCheck, questionChecks } from "./validate-questions";
import { type Check, type Edge, nodeOf, openScan, type Scan, touch } from "./validate-scan";
import { sprintChecks } from "./validate-sprints";

export type { BatchContext } from "./expected";
export { captureExpected } from "./expected";
export { assignableAgents, assignableEntry } from "./overview";

export type ActionProblem = { actionId: number; type: ActionType; message: string };
export type ValidBatch = { actions: ProposedAction[]; expected: ExpectedState[] };
export type BatchValidation = { ok: true; batch: ValidBatch } | { ok: false; problems: ActionProblem[] };

function refProblem(scan: Scan, ref: string, index: number): string | null {
  if (!isNewRef(ref)) return ticketByKey(scan.ctx.project)(ref) ? null : `ticket inconnu « ${ref} »`;
  const at = scan.declared.get(ref);
  if (at === undefined) return `référence ${ref} inconnue`;
  return at >= index ? `référence ${ref} déclarée après usage` : null;
}

function signalProblem(scan: Scan, ref: string): string | null {
  if (scan.ctx.signals.includes(ref)) return null;
  return scan.ctx.closedSignals.includes(ref) ? `signal déjà clos « ${ref} »` : `signal inconnu « ${ref} »`;
}

function statusProblems(scan: Scan, statusId: string | undefined, reason: string | undefined): string[] {
  if (statusId === undefined) return [];
  if (!scan.ctx.project.workflow.some((s) => s.id === statusId)) return [`statut inconnu « ${statusId} »`];
  return statusId === "blocked" && !reason?.trim() ? ["raison de blocage requise"] : [];
}

function reaches(edges: readonly Edge[], start: string, goal: string): boolean {
  const queue = [start];
  const seen = new Set<string>();
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (id === goal) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.from === id) queue.push(e.to);
  }
  return false;
}

function parentCycle(scan: Scan, node: string, parent: string): boolean {
  const seen = new Set<string>();
  for (let cur: string | null = parent; cur !== null && !seen.has(cur); cur = scan.parents.get(cur) ?? null) {
    if (cur === node) return true;
    seen.add(cur);
  }
  return false;
}

function answerProblem(q: Question, answer: AnswerInput): string | null {
  switch (answer.kind) {
    case "option":
      return answer.option !== undefined && q.options.includes(answer.option)
        ? null
        : `option inconnue « ${answer.option ?? ""} »`;
    case "confirm":
      return q.provisional === null ? "aucun choix provisoire à confirmer" : null;
    case "text": {
      const text = answer.text?.trim() ?? "";
      if (!text) return "texte vide";
      return text.length > ANSWER_TEXT_MAX ? "texte trop long" : null;
    }
  }
}

function existingLink(scan: Scan, kind: "blocks" | "relates", from: string, to: string) {
  return scan.ctx.project.links.find(
    (l) =>
      !scan.removed.has(l.id) &&
      l.type === kind &&
      ((l.from === from && l.to === to) || (kind === "relates" && l.from === to && l.to === from)),
  );
}

const checks: { [T in ActionType]: Check<T> } = {
  createTicket(scan, a, i) {
    if (scan.declared.get(a.ref) !== i) return [`référence ${a.ref} déclarée deux fois`];
    const problems = statusProblems(scan, a.statusId, a.blockedReason);
    if (problems.length === 0)
      scan.parents.set(a.ref, a.parent === undefined ? null : nodeOf(scan, a.parent));
    return problems;
  },
  updateTicket(scan, a) {
    const fields = (["title", "description", "labels", "parent"] as const).filter((f) => a[f] !== undefined);
    if (fields.length === 0) return ["rien à modifier"];
    const node = nodeOf(scan, a.ticket);
    if (typeof a.parent === "string" && parentCycle(scan, node, nodeOf(scan, a.parent))) {
      return [`parent en cycle : ${a.parent}`];
    }
    const problems = fields.flatMap((f) => touch(scan, `${a.ticket}.${f === "parent" ? "parentId" : f}`));
    if (problems.length === 0 && a.parent !== undefined) {
      scan.parents.set(node, a.parent === null ? null : nodeOf(scan, a.parent));
    }
    return problems;
  },
  setStatus(scan, a) {
    const problems = statusProblems(scan, a.statusId, a.blockedReason);
    return problems.length > 0 ? problems : touch(scan, `${a.ticket}.statusId`);
  },
  link(scan, a) {
    const [from, to] = [nodeOf(scan, a.from), nodeOf(scan, a.to)];
    if (from === to) return ["un ticket ne peut pas se lier à lui-même"];
    if (existingLink(scan, "blocks", from, to)) return ["lien déjà présent"];
    if (reaches(scan.blocks, to, from)) return [`lien en cycle : ${a.from} → ${a.to}`];
    const problems = touch(scan, `${a.from}→${a.to}`);
    if (problems.length === 0) scan.blocks.push({ from, to });
    return problems;
  },
  unlink(scan, a) {
    const [from, to] = [nodeOf(scan, a.from), nodeOf(scan, a.to)];
    const found = existingLink(scan, a.kind, from, to);
    if (!found) return ["lien introuvable"];
    const problems = touch(scan, `${a.from}→${a.to}`);
    if (problems.length > 0) return problems;
    scan.removed.add(found.id);
    scan.blocks = scan.blocks.filter(
      (e) => !(found.type === "blocks" && e.from === found.from && e.to === found.to),
    );
    return [];
  },
  assignAgent(scan, a) {
    const assignable = assignableAgents(scan.ctx.agents, scan.ctx.demoProject).some(
      (p) => p.ref === a.profileId,
    );
    return assignable ? touch(scan, `${a.ticket}.agent`) : [`agent non assignable « ${a.profileId} »`];
  },
  deliverAnswers(scan, a) {
    const ticket = ticketByKey(scan.ctx.project)(a.ticket);
    const pending = ticket ? answersToDeliver(scan.ctx.project.questions, ticket.id) : [];
    return pending.length > 0
      ? touch(scan, `${a.ticket}.answers`)
      : [`aucune réponse à transmettre sur ${a.ticket}`];
  },
  cancelRun(scan, a) {
    const target = ticketRuns(scan.ctx.runs, scan.ctx.project.meta.id).find((r) => r.id === a.runId);
    if (!target) return [`run inconnu « ${a.runId} »`];
    return isTerminal(target.state) ? [`run déjà terminé « ${a.runId} »`] : touch(scan, `${a.runId}.run`);
  },
  answerQuestion(scan, a) {
    const problem = answerQuestionCheck(scan, a.questionId);
    if (typeof problem === "string") return [problem];
    const invalid = answerProblem(problem, a.answer);
    return invalid ? [`réponse invalide : ${invalid}`] : touch(scan, `${a.questionId}.answer`);
  },
  ...questionChecks,
  createNote(scan, a) {
    if (scan.ctx.notes.some((n) => n.path === a.path)) return [`note déjà existante « ${a.path} »`];
    return touch(scan, `${a.path}.content`);
  },
  updateNote(scan, a) {
    if (!scan.ctx.notes.some((n) => n.path === a.path)) return [`note introuvable « ${a.path} »`];
    return touch(scan, `${a.path}.content`);
  },
  dismissSignal(scan, a) {
    return touch(scan, a.signal);
  },
  ...sprintChecks,
};

function runCheck<T extends ActionType>(
  scan: Scan,
  action: Extract<ProposedAction, { type: T }>,
  index: number,
) {
  const check: Check<T> = checks[action.type];
  return check(scan, action, index);
}

const adoptedBy = (scan: Scan, action: ProposedAction): string | null =>
  (action.type === "createTicket" || action.type === "updateTicket") && typeof action.parent === "string"
    ? nodeOf(scan, action.parent)
    : null;

function parentProblem(scan: Scan, ticket: string, later: readonly ProposedAction[]): string | null {
  const node = nodeOf(scan, ticket);
  const children =
    [...scan.parents.values()].filter((p) => p === node).length +
    later.filter((a) => adoptedBy(scan, a) === node).length;
  return children > 0
    ? `ce ticket regroupe ${children} sous-ticket${children > 1 ? "s" : ""} : lance les sous-tickets`
    : null;
}

function actionProblems(
  scan: Scan,
  actions: readonly ProposedAction[],
  action: ProposedAction,
  index: number,
) {
  const refs = [
    ...ticketRefsOf(action).flatMap((ref) => refProblem(scan, ref, index) ?? []),
    ...[...new Set(signalRefsOf(action))].flatMap((ref) => signalProblem(scan, ref) ?? []),
  ];
  if (refs.length > 0) return refs;
  const parent =
    action.type === "assignAgent" ? parentProblem(scan, action.ticket, actions.slice(index + 1)) : null;
  return parent === null ? runCheck(scan, action, index) : [parent];
}

export function validateBatch(input: ProposeBatchInput, ctx: BatchContext): BatchValidation {
  const scan = openScan(input, ctx);
  const ids = new Set<number>();
  const problems = input.actions.flatMap((action, index): ActionProblem[] => {
    const messages = ids.has(action.id)
      ? ["identifiant d'action en double"]
      : actionProblems(scan, input.actions, action, index);
    ids.add(action.id);
    return messages.map((message) => ({ actionId: action.id, type: action.type, message }));
  });
  if (problems.length > 0) return { ok: false, problems };
  const actions = [...input.actions];
  return {
    ok: true,
    batch: { actions, expected: actions.map((a) => ({ actionId: a.id, fields: captureExpected(a, ctx) })) },
  };
}

export const renderProblems = (problems: readonly ActionProblem[]): string =>
  problems.map((p) => `#${p.actionId} ${p.type} : ${p.message}`).join("\n");

const ELIDED = /^[aeiouyhàâäéèêëîïôöùûü]/i;

export const registeredText = (batch: Pick<Batch, "seq">, viewer: string): string =>
  `Lot ${batch.seq} enregistré, en attente de validation ${ELIDED.test(viewer) ? "d'" : "de "}${viewer}.`;
