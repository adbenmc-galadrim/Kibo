import {
  type AgentProfile,
  isOpen,
  isTerminal,
  MEMORY_NOTE_PATH,
  type ProjectOverview,
  type ProjectSnapshot,
  type QueueEntry,
  type RunView,
  type TicketCard,
} from "@kibo/schema";
import { RUN_STATE_TEXT } from "./digest";
import { ticketCard } from "./ticket-card";
import { ticketKeyOf, truncate } from "./ticket-facts";
import { listRuns } from "./tools";

export { ticketCard, ticketSheet } from "./ticket-card";

export type OverviewInput = {
  project: ProjectSnapshot;
  runs: readonly RunView[];
  queue: readonly QueueEntry[];
  notes: readonly { path: string; title: string }[];
  profiles: readonly AgentProfile[];
  demoProject: boolean;
  memory: string;
};

export const ACTIVE_STATUSES: readonly string[] = ["in_progress", "in_review", "blocked"];
export const OVERVIEW_TITLE_MAX = 80;
const BUDGET = { tickets: 2_400, runs: 600, questions: 800, notes: 600 };

export function assignableProfiles(profiles: readonly AgentProfile[], demoProject: boolean): AgentProfile[] {
  return profiles.filter((p) => p.enabled && (!p.system || (demoProject && p.id === "demo")));
}

export function projectOverview(input: OverviewInput): ProjectOverview {
  const { project } = input;
  const statuses = [...project.workflow].sort((a, b) => a.order - b.order);
  return {
    name: project.meta.name,
    key: project.meta.key,
    statuses: statuses.map((s) => ({
      id: s.id,
      name: s.label,
      count: project.tickets.filter((t) => t.statusId === s.id).length,
    })),
    active: project.tickets
      .filter((t) => ACTIVE_STATUSES.includes(t.statusId))
      .map((t) => ticketCard(project, t)),
    runs: listRuns(input.runs, input.queue, project.meta.id).filter((r) => !isTerminal(r.state)),
    openQuestions: project.questions.filter(isOpen).map((q) => ({
      id: q.id,
      ticket: ticketKeyOf(project, q.ticketId),
      title: q.title,
      blocking: q.blocking,
    })),
    notes: input.notes.map((n) => ({ path: n.path, title: n.title })),
    profiles: assignableProfiles(input.profiles, input.demoProject).map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model,
    })),
    memory: input.memory,
  };
}

function bounded(lines: readonly string[], budget: number, rest: (n: number) => string): string[] {
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > budget) return [...kept, rest(lines.length - kept.length)];
    kept.push(line);
    used += line.length + 1;
  }
  return kept;
}

function cardLine(card: TicketCard): string {
  const facts = [
    ...(card.labels.length > 0 ? [`étiquettes ${card.labels.join(", ")}`] : []),
    ...(card.assignee ? [`assigné ${card.assignee}`] : []),
    ...(card.pr ? [`PR ${card.pr}`] : []),
  ];
  const head = `- ${card.key} · ${truncate(card.title, OVERVIEW_TITLE_MAX)} [${card.statusId}]`;
  return facts.length > 0 ? `${head} ${facts.join(" · ")}` : head;
}

function section(title: string, lines: readonly string[], empty: string): string[] {
  return ["", `## ${title}`, "", ...(lines.length > 0 ? lines : [empty])];
}

export function renderOverview(overview: ProjectOverview): string {
  const runs = overview.runs.map(
    (r) =>
      `- ${r.label} · ${r.subject} : ${RUN_STATE_TEXT[r.state]}${r.position === null ? "" : ` (position ${r.position})`}`,
  );
  const questions = overview.openQuestions.map(
    (q) =>
      `- ${q.id} · ${q.ticket} · ${truncate(q.title, OVERVIEW_TITLE_MAX)}${q.blocking ? " (bloquante)" : ""}`,
  );
  return [
    `# ${overview.name} (${overview.key})`,
    ...section("Statuts", [overview.statuses.map((s) => `${s.name} (${s.id}) ${s.count}`).join(" · ")], ""),
    ...section(
      "Tickets actifs",
      bounded(overview.active.map(cardLine), BUDGET.tickets, (n) => `- … ${n} autres : \`list_tickets\``),
      "Aucun.",
    ),
    ...section(
      "Runs",
      bounded(runs, BUDGET.runs, (n) => `- … ${n} autres : \`list_runs\``),
      "Aucun.",
    ),
    ...section(
      "Questions ouvertes",
      bounded(questions, BUDGET.questions, (n) => `- … ${n} autres : \`list_questions\``),
      "Aucune.",
    ),
    ...section(
      "Notes",
      bounded(
        overview.notes.map((n) => `- ${n.path} · ${truncate(n.title, OVERVIEW_TITLE_MAX)}`),
        BUDGET.notes,
        (n) => `- … ${n} autres : \`list_notes\``,
      ),
      "Aucune.",
    ),
    ...section(
      "Profils assignables",
      overview.profiles.map((p) => `- ${p.id} (${p.name}, ${p.model})`),
      "Aucun.",
    ),
    ...section(
      `Mémoire (${MEMORY_NOTE_PATH})`,
      overview.memory.trim() ? [overview.memory.trim()] : [],
      "Vide.",
    ),
  ].join("\n");
}
