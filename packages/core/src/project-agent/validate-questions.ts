import {
  findRecipient,
  isAnswered,
  isArchived,
  isDelivered,
  isOpen,
  isTerminal,
  type Question,
  type QuestionRecipient,
  RECIPIENTS_MAX,
} from "@kibo/schema";
import { type Check, type Scan, touch } from "./validate-scan";

type QuestionAction =
  | "createQuestion"
  | "updateQuestion"
  | "reopenQuestion"
  | "deleteQuestion"
  | "addRecipient";

const questionOf = (scan: Scan, id: string): Question | undefined =>
  scan.ctx.project.questions.find((q) => q.id === id);

function liveQuestion(scan: Scan, id: string): Question | string {
  const q = questionOf(scan, id);
  if (!q) return `question inconnue « ${id} »`;
  return isArchived(q) ? `question archivée « ${id} »` : q;
}

export function answerQuestionCheck(scan: Scan, id: string): Question | string {
  const q = liveQuestion(scan, id);
  if (typeof q === "string" || !isAnswered(q)) return q;
  return `question déjà répondue « ${id} »`;
}

function activeRunProblem(scan: Scan, q: Question): string[] {
  if (!isOpen(q) || q.runId === null) return [];
  const run = scan.ctx.runs.find((r) => r.id === q.runId && !isTerminal(r.state));
  return run ? [`question d'un run actif « ${run.label} » : réponds-y`] : [];
}

const knownRecipients = (scan: Scan): QuestionRecipient[] => [
  ...scan.ctx.project.questionRecipients,
  ...scan.recipients.map((name) => ({ id: name, name })),
];

function recipientProblem(scan: Scan, raw: string | undefined): string[] {
  if (raw === undefined || findRecipient(knownRecipients(scan), raw.trim())) return [];
  const names = scan.ctx.project.questionRecipients.map((r) => r.name).join(", ");
  return [
    `destinataire inconnu « ${raw} » ; destinataires du projet : ${names} ; ajoute-le par addRecipient`,
  ];
}

function optionProblems(options: readonly string[], provisional: string | null): string[] {
  if (new Set(options).size !== options.length) return ["options en double"];
  const outside = provisional !== null && options.length > 0 && !options.includes(provisional);
  return outside ? ["choix provisoire hors des options"] : [];
}

const UPDATE_FIELDS = ["title", "context", "options", "provisional", "ticket", "recipient"] as const;

const updateQuestion: Check<"updateQuestion"> = (scan, a) => {
  const q = liveQuestion(scan, a.questionId);
  if (typeof q === "string") return [q];
  if (UPDATE_FIELDS.every((f) => a[f] === undefined)) return ["rien à modifier"];
  const reopened = scan.reopened.has(q.id);
  if (isDelivered(q) && !reopened)
    return ["réponse déjà transmise à un agent : rouvre-la d'abord (reopenQuestion)"];
  if (isAnswered(q) && !reopened && (a.options !== undefined || a.provisional !== undefined)) {
    return ["question répondue : options et choix provisoire figés, rouvre-la d'abord"];
  }
  const problems = [
    ...optionProblems(a.options ?? q.options, a.provisional ?? q.provisional),
    ...(a.ticket === undefined ? [] : activeRunProblem(scan, q)),
    ...recipientProblem(scan, a.recipient),
  ];
  return problems.length > 0 ? problems : touch(scan, `${q.id}.question`);
};

const reopenQuestion: Check<"reopenQuestion"> = (scan, a) => {
  const q = liveQuestion(scan, a.questionId);
  if (typeof q === "string") return [q];
  if (!isAnswered(q)) return ["question déjà ouverte"];
  const problems = touch(scan, `${q.id}.answer`);
  if (problems.length === 0) scan.reopened.add(q.id);
  return problems;
};

const deleteQuestion: Check<"deleteQuestion"> = (scan, a) => {
  const q = questionOf(scan, a.questionId);
  if (!q) return [`question inconnue « ${a.questionId} »`];
  if (isArchived(q)) return [`question déjà archivée « ${q.id} »`];
  const active = activeRunProblem(scan, q);
  if (active.length > 0) return active;
  const problems = touch(scan, `${q.id}.question`);
  return problems.length > 0 ? problems : touch(scan, `${q.id}.answer`);
};

const addRecipient: Check<"addRecipient"> = (scan, a) => {
  if (findRecipient(knownRecipients(scan), a.name.trim())) return ["destinataire déjà présent"];
  if (knownRecipients(scan).length >= RECIPIENTS_MAX) return [`${RECIPIENTS_MAX} destinataires au plus`];
  scan.recipients.push(a.name.trim());
  return [];
};

const createQuestion: Check<"createQuestion"> = (scan, a) => [
  ...optionProblems(a.options ?? [], a.provisional ?? null),
  ...recipientProblem(scan, a.recipient),
];

export const questionChecks: { [T in QuestionAction]: Check<T> } = {
  createQuestion,
  updateQuestion,
  reopenQuestion,
  deleteQuestion,
  addRecipient,
};
