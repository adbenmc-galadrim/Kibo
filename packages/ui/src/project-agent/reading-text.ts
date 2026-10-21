import { ListQuestionsInput, MEMORY_NOTE_PATH, type ProjectAgentTool } from "@kibo/schema";
import { frProjectAgent } from "../i18n/fr-project-agent";
import { type DiffLabels, defaultLabels } from "./batch-groups";

type ReadTool = Exclude<ProjectAgentTool, "propose_batch">;
type Label = (detail: string | null, labels: DiffLabels) => string;

const t = frProjectAgent.conversation;
const r = t.read;

const ticketLabel = (key: string, labels: DiffLabels): string => labels.feature?.(key).label ?? key;

function filtersOf(detail: string | null): Map<string, string> {
  const pairs = (detail ?? "").split(" ").flatMap((part): [string, string][] => {
    const at = part.indexOf("=");
    return at > 0 ? [[part.slice(0, at), part.slice(at + 1)]] : [];
  });
  return new Map(pairs);
}

function questionsLabel(detail: string | null, labels: DiffLabels): string {
  const filters = filtersOf(detail);
  const state = ListQuestionsInput.shape.state.safeParse(filters.get("state"));
  const questions = r.questions[state.success ? state.data : "all"];
  const ticket = filters.get("ticketKey");
  return ticket ? r.questionsOf(questions, ticketLabel(ticket, labels)) : questions;
}

function noteLabel(path: string | null): string {
  if (path === MEMORY_NOTE_PATH) return r.memoryNote;
  const name = (path ?? "").slice((path ?? "").lastIndexOf("/") + 1);
  return r.note(name.replace(/\.md$/, ""));
}

const LABELS: Record<ReadTool, Label> = {
  project_overview: () => r.overview,
  list_sprints: () => r.planning,
  list_tickets: () => r.tickets,
  get_ticket: (detail, labels) => (detail ? ticketLabel(detail, labels) : r.ticket),
  list_questions: questionsLabel,
  list_runs: () => r.runs,
  list_notes: () => r.notes,
  read_note: noteLabel,
  list_profiles: () => r.profiles,
  project_changes: () => r.changes,
  list_signals: () => r.signals,
};

const isReadTool = (name: string): name is ReadTool => Object.hasOwn(LABELS, name);

function readLabel(tool: string, labels: DiffLabels): string {
  const space = tool.indexOf(" ");
  const name = space < 0 ? tool : tool.slice(0, space);
  const detail = space < 0 ? null : tool.slice(space + 1);
  return isReadTool(name) ? LABELS[name](detail, labels) : name;
}

export function readingText(tools: readonly string[], labels: DiffLabels = defaultLabels): string {
  return t.reading([...new Set(tools.map((tool) => readLabel(tool, labels)))]);
}
