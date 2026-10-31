import {
  ACTION_GROUPS,
  type ActionGroup,
  type AnswerInput,
  DEFAULT_WORKFLOW,
  type ExpectedState,
  findRecipient,
  isRetiredAction,
  type ProjectSnapshot,
  type ProposedAction,
  type RetiredAction,
  type StoredProposedAction,
} from "@kibo/schema";
import { frProjectAgent } from "../i18n/fr-project-agent";

type BatchGroup = { group: ActionGroup; actions: ProposedAction[] };
export type ActionDiff = { field?: string; before: string; after: string };
export type DiffLabels = {
  status(statusId: string): string;
  ticket(ticketId: string): string | null;
  question(questionId: string): string | null;
  recipient(recipient: string): string;
  feature?(ticket: string): FeatureLabel;
  reminder?(questionId: string): Reminder | null;
};
export type FeatureLabel = { label: string; sprint: string | null };
export type Reminder = { recipient: string; ref: string };

const ORDER: readonly ActionGroup[] = ["tickets", "sprints", "questions", "notes"];
const t = frProjectAgent.action;
const field = frProjectAgent.field;
const NOTHING = "—";
const CLIENT_RECIPIENT = "client";

export const defaultLabels: DiffLabels = {
  status: (id) => DEFAULT_WORKFLOW.find((s) => s.id === id)?.label ?? id,
  ticket: () => null,
  question: () => null,
  recipient: (id) => id,
};

export function projectLabels(project: ProjectSnapshot): DiffLabels {
  return {
    status: (id) => project.workflow.find((s) => s.id === id)?.label ?? id,
    ticket: (id) => project.tickets.find((t) => t.id === id)?.keyLabel ?? null,
    question: (id) => project.questions.find((q) => q.id === id)?.title ?? null,
    recipient: (raw) => findRecipient(project.questionRecipients, raw)?.name ?? raw,
    feature: (key) => featureLabel(project, key),
    reminder: (id) => reminderOf(project, id),
  };
}

function featureLabel(project: ProjectSnapshot, key: string): FeatureLabel {
  const ticket = project.tickets.find((t) => t.key === key);
  if (!ticket) return { label: key, sprint: null };
  const sprint = project.sprints.find((s) => s.id === ticket.sprintId);
  return { label: ticket.shortKey ?? ticket.keyLabel, sprint: sprint?.code ?? null };
}

function reminderOf(project: ProjectSnapshot, id: string): Reminder | null {
  const question = project.questions.find((q) => q.id === id);
  if (!question) return null;
  const recipient =
    question.recipient === CLIENT_RECIPIENT
      ? t.theClient
      : (findRecipient(project.questionRecipients, question.recipient)?.name ?? question.recipient);
  return { recipient, ref: question.importRef?.id ?? t.quoted(question.title) };
}

const isLive = (action: StoredProposedAction): action is ProposedAction => !isRetiredAction(action);

export const retiredActions = (actions: readonly StoredProposedAction[]): RetiredAction[] =>
  actions.filter(isRetiredAction);

export function groupActions(actions: readonly StoredProposedAction[]): BatchGroup[] {
  const sorted = actions.filter(isLive).sort((a, b) => a.id - b.id);
  return ORDER.flatMap((group) => {
    const inGroup = sorted.filter((a) => ACTION_GROUPS[a.type] === group);
    return inGroup.length === 0 ? [] : [{ group, actions: inGroup }];
  });
}

const answerText = (answer: AnswerInput): string =>
  answer.kind === "option" ? (answer.option ?? "") : answer.kind === "text" ? (answer.text ?? "") : t.confirm;

const questionTitle = (id: string, labels: DiffLabels): string => labels.question(id) ?? t.unknownQuestion;

export function actionTitle(action: ProposedAction, labels: DiffLabels = defaultLabels): string {
  switch (action.type) {
    case "createTicket":
      return t.createTicket(action.title);
    case "updateTicket":
      return t.updateTicket(action.ticket);
    case "setStatus":
      return t.setStatus(action.ticket, labels.status(action.statusId));
    case "link":
      return t.link(action.from, action.to);
    case "unlink":
      return t.unlink(action.from, action.to);
    case "answerQuestion":
      return t.answerQuestion(answerText(action.answer));
    case "createQuestion":
      return action.recipient === undefined
        ? t.createQuestion(action.ticket, action.title)
        : t.createQuestionFor(action.ticket, labels.recipient(action.recipient), action.title);
    case "updateQuestion":
      return t.updateQuestion(questionTitle(action.questionId, labels));
    case "reopenQuestion":
      return t.reopenQuestion(questionTitle(action.questionId, labels));
    case "deleteQuestion":
      return t.deleteQuestion(questionTitle(action.questionId, labels));
    case "addRecipient":
      return t.addRecipient(action.name);
    case "createNote":
      return t.createNote(action.path);
    case "updateNote":
      return t.updateNote(action.path);
    case "setSprint":
      return sprintTitle(action, labels);
    case "createSprint":
      return t.createSprint(action.code, action.name);
    case "remindQuestion":
      return reminderTitle(action.questionId, labels);
    case "setHold":
      return action.reason === null ? t.resume(action.ticket) : t.hold(action.ticket, action.reason);
  }
}

function sprintTitle(action: Extract<ProposedAction, { type: "setSprint" }>, labels: DiffLabels): string {
  const feature = labels.feature?.(action.ticket) ?? { label: action.ticket, sprint: null };
  if (action.sprint === null) return t.unplan(feature.label);
  return feature.sprint === null
    ? t.plan(feature.label, action.sprint)
    : t.postpone(feature.label, action.sprint);
}

function reminderTitle(questionId: string, labels: DiffLabels): string {
  const reminder = labels.reminder?.(questionId);
  return reminder ? t.remindQuestion(reminder.recipient, reminder.ref) : t.remindUnknown;
}

const textOf = (value: unknown): string => (typeof value === "string" && value !== "" ? value : NOTHING);
const listOf = (value: unknown): string =>
  Array.isArray(value) && value.length > 0 ? value.map(String).join(", ") : t.none;

function parentOf(fields: Record<string, unknown>, labels: DiffLabels): string {
  if (!("parentId" in fields)) return NOTHING;
  const id = fields.parentId;
  if (typeof id !== "string") return t.none;
  return labels.ticket(id) ?? t.unknownTicket;
}

export function actionDiff(
  action: ProposedAction,
  expected: ExpectedState | undefined,
  labels: DiffLabels = defaultLabels,
): ActionDiff | null {
  const fields = expected?.fields ?? {};
  if (action.type === "setStatus") {
    const before = typeof fields.statusId === "string" ? labels.status(fields.statusId) : NOTHING;
    return { before, after: labels.status(action.statusId) };
  }
  if (action.type !== "updateTicket") return null;
  if (action.title !== undefined) return { before: textOf(fields.title), after: action.title };
  if (action.labels !== undefined) return { before: listOf(fields.labels), after: listOf(action.labels) };
  if (action.parent !== undefined)
    return { before: parentOf(fields, labels), after: action.parent ?? t.none };
  return null;
}

type QuestionUpdate = Extract<ProposedAction, { type: "updateQuestion" }>;

const recipientOf = (value: unknown, labels: DiffLabels): string =>
  typeof value === "string" ? labels.recipient(value) : NOTHING;

const ticketOf = (value: unknown, labels: DiffLabels): string =>
  typeof value === "string" ? (labels.ticket(value) ?? t.unknownTicket) : NOTHING;

const choiceOf = (value: unknown): string => (typeof value === "string" ? value : t.none);

function questionDiffs(
  action: QuestionUpdate,
  fields: Record<string, unknown>,
  labels: DiffLabels,
): ActionDiff[] {
  const lines: ActionDiff[] = [];
  if (action.title !== undefined)
    lines.push({ field: field.title, before: textOf(fields.title), after: action.title });
  if (action.recipient !== undefined)
    lines.push({
      field: field.recipient,
      before: recipientOf(fields.recipient, labels),
      after: labels.recipient(action.recipient),
    });
  if (action.ticket !== undefined)
    lines.push({ field: field.ticket, before: ticketOf(fields.ticketId, labels), after: action.ticket });
  if (action.options !== undefined)
    lines.push({ field: field.options, before: listOf(fields.options), after: listOf(action.options) });
  if (action.provisional !== undefined)
    lines.push({
      field: field.provisional,
      before: choiceOf(fields.provisional),
      after: choiceOf(action.provisional),
    });
  return lines;
}

export function actionDiffs(
  action: ProposedAction,
  expected: ExpectedState | undefined,
  labels: DiffLabels = defaultLabels,
): ActionDiff[] {
  if (action.type === "updateQuestion") return questionDiffs(action, expected?.fields ?? {}, labels);
  const diff = actionDiff(action, expected, labels);
  return diff ? [diff] : [];
}

export const questionOf = (action: ProposedAction): string | null =>
  action.type === "updateQuestion" ||
  action.type === "reopenQuestion" ||
  action.type === "deleteQuestion" ||
  action.type === "answerQuestion"
    ? action.questionId
    : null;

export const replacesContent = (action: ProposedAction): boolean =>
  action.type === "updateNote" ||
  (action.type === "updateTicket" && action.description !== undefined) ||
  (action.type === "updateQuestion" && action.context !== undefined);
