import {
  type ActionType,
  ANSWER_TEXT_MAX,
  type AnswerInput,
  type Batch,
  type ExpectedState,
  type ProposeBatchInput,
  type ProposedAction,
  type Question,
} from "@kibo/schema";
import { type BatchContext, captureExpected, ticketByKey } from "./expected";
import { isNewRef, ticketRefsOf } from "./refs";
import { holdChecks } from "./validate-hold";
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
    if (a.feature === true && a.parent !== undefined) return ["une fonctionnalité est un ticket racine"];
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
  ...sprintChecks,
  ...holdChecks,
};

function runCheck<T extends ActionType>(
  scan: Scan,
  action: Extract<ProposedAction, { type: T }>,
  index: number,
) {
  const check: Check<T> = checks[action.type];
  return check(scan, action, index);
}

function actionProblems(scan: Scan, action: ProposedAction, index: number) {
  const refs = ticketRefsOf(action).flatMap((ref) => refProblem(scan, ref, index) ?? []);
  return refs.length > 0 ? refs : runCheck(scan, action, index);
}

export function validateBatch(input: ProposeBatchInput, ctx: BatchContext): BatchValidation {
  const scan = openScan(input, ctx);
  const ids = new Set<number>();
  const problems = input.actions.flatMap((action, index): ActionProblem[] => {
    const messages = ids.has(action.id)
      ? ["identifiant d'action en double"]
      : actionProblems(scan, action, index);
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
