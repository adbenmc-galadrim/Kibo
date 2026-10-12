import {
  ACTION_GROUPS,
  type ActionGroup,
  type AgentSummary,
  type AnswerInput,
  DEFAULT_WORKFLOW,
  type ExpectedState,
  type ProjectSnapshot,
  type ProposedAction,
  type Signal,
} from "@kibo/schema";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { frSignals } from "../i18n/fr-signals";

export type BatchGroup = { group: ActionGroup; actions: ProposedAction[] };
export type ActionDiff = { before: string; after: string };
export type DiffLabels = {
  status(statusId: string): string;
  ticket(ticketId: string): string | null;
  profile(profileId: string): string;
};

const ORDER: readonly ActionGroup[] = ["tickets", "agents", "questions", "notes", "signals"];
const t = frProjectAgent.action;
const NOTHING = "—";

export const defaultLabels: DiffLabels = {
  status: (id) => DEFAULT_WORKFLOW.find((s) => s.id === id)?.label ?? id,
  ticket: () => null,
  profile: (id) => id,
};

export function projectLabels(
  project: ProjectSnapshot,
  agents: readonly Pick<AgentSummary, "ref" | "name">[] = [],
): DiffLabels {
  return {
    status: (id) => project.workflow.find((s) => s.id === id)?.label ?? id,
    ticket: (id) => project.tickets.find((t) => t.id === id)?.keyLabel ?? null,
    profile: (id) => agents.find((a) => a.ref === id)?.name ?? id.slice(id.lastIndexOf(":") + 1),
  };
}

export function groupActions(actions: readonly ProposedAction[]): BatchGroup[] {
  const sorted = [...actions].sort((a, b) => a.id - b.id);
  return ORDER.flatMap((group) => {
    const inGroup = sorted.filter((a) => ACTION_GROUPS[a.type] === group);
    return inGroup.length === 0 ? [] : [{ group, actions: inGroup }];
  });
}

const answerText = (answer: AnswerInput): string =>
  answer.kind === "option" ? (answer.option ?? "") : answer.kind === "text" ? (answer.text ?? "") : t.confirm;

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
    case "assignAgent":
      return t.assignAgent(action.ticket, labels.profile(action.profileId));
    case "deliverAnswers":
      return t.deliverAnswers(action.ticket);
    case "cancelRun":
      return t.cancelRun(action.runId);
    case "answerQuestion":
      return t.answerQuestion(answerText(action.answer));
    case "createQuestion":
      return t.createQuestion(action.ticket, action.title);
    case "createNote":
      return t.createNote(action.path);
    case "updateNote":
      return t.updateNote(action.path);
    case "dismissSignal":
      return t.dismissSignal(action.signal);
  }
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

export const replacesContent = (action: ProposedAction): boolean =>
  action.type === "updateNote" || (action.type === "updateTicket" && action.description !== undefined);

export function citedSignals(action: ProposedAction, signals: readonly Signal[]): Signal[] {
  const refs = action.type === "dismissSignal" ? [action.signal] : (action.signals ?? []);
  return refs.flatMap((ref) => signals.find((s) => s.ref === ref) ?? []);
}

export const signalProvenance = (action: ProposedAction, signals: readonly Signal[]): string[] =>
  citedSignals(action, signals).map((s) => frSignals.provenance(frSignals.kinds[s.kind], s.runLabel));
