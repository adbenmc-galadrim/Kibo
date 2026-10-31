import {
  atRisk,
  blockedCount,
  blockingQuestion,
  currentSprint,
  featureLabel,
  featureSteps,
  type GithubPrRef,
  isBlocked,
  isFeature,
  isLivePr,
  isOpen,
  openCount,
  overviewIndicators,
  type ProjectSnapshot,
  questionLabel,
  type SprintView,
  type TicketView,
} from "@kibo/schema";

type ProjectRef = { projectId: string; projectKey: string; folderMissing: boolean };
type TicketRow = ProjectRef & { ticket: TicketView };

type BlockReason =
  | { kind: "question"; label: string; feature: string | null; detail: string | null }
  | { kind: "status"; detail: string | null };
export type TodayBlocked = TicketRow & { reason: BlockReason };
export type TodayPrState = "changes" | "ci-ok" | "ci-running" | "review";
export type TodayPr = TicketRow & { pr: GithubPrRef; state: TodayPrState };
export type TodayStartable = TicketRow & {
  feature: { label: string; title: string } | null;
  current: boolean;
  free: boolean;
};
export type TodayProject = {
  id: string;
  key: string;
  name: string;
  color: string;
  client: string | null;
  progress: { done: number; total: number } | null;
  open: number;
  blocked: number;
  risk: number;
  sprint: string | null;
};
export type TodayModel = {
  date: string;
  projectCount: number;
  openTickets: number;
  blocking: TodayBlocked[];
  blockingQuestions: number;
  prsToReview: TodayPr[];
  startable: TodayStartable[];
  projects: TodayProject[];
};

const byKey = (a: TicketRow, b: TicketRow): number =>
  a.ticket.keyLabel.localeCompare(b.ticket.keyLabel, "fr", { numeric: true });

const workOf = (project: ProjectSnapshot): TicketView[] => project.tickets.filter((t) => !isFeature(t));

const refOf = (project: ProjectSnapshot): ProjectRef => ({
  projectId: project.meta.id,
  projectKey: project.meta.key,
  folderMissing: project.meta.folder === null,
});

const parentOf = (project: ProjectSnapshot, ticket: TicketView): TicketView | undefined =>
  project.tickets.find((t) => t.id === ticket.parentId);

function blockReason(project: ProjectSnapshot, ticket: TicketView): BlockReason {
  const detail = ticket.statusId === "blocked" ? ticket.blockedReason : null;
  const question = blockingQuestion(ticket, project.questions);
  if (question === null) return { kind: "status", detail };
  const parent = parentOf(project, ticket);
  return {
    kind: "question",
    label: questionLabel(question),
    feature: parent === undefined ? null : featureLabel(parent),
    detail,
  };
}

const blockedRows = (project: ProjectSnapshot): TodayBlocked[] =>
  workOf(project)
    .filter((t) => isBlocked(t, project.questions))
    .map((ticket) => ({ ...refOf(project), ticket, reason: blockReason(project, ticket) }))
    .sort(byKey);

const prRank = (row: TodayPr): number => (row.state === "changes" ? 0 : 1);

function prState(pr: GithubPrRef): TodayPrState {
  if (pr.review === "changes_requested") return "changes";
  if (pr.checks === "ok") return "ci-ok";
  return pr.checks === "running" ? "ci-running" : "review";
}

function prRows(project: ProjectSnapshot): TodayPr[] {
  const seen = new Set<number>();
  const rows: TodayPr[] = [];
  for (const ticket of project.tickets)
    for (const ref of ticket.externalRefs) {
      if (ref.kind !== "github_pr" || !isLivePr(ref) || seen.has(ref.number)) continue;
      seen.add(ref.number);
      rows.push({ ...refOf(project), ticket, pr: ref, state: prState(ref) });
    }
  return rows;
}

function startableRows(project: ProjectSnapshot, sprint: SprintView | null): TodayStartable[] {
  const dependents = new Set(project.links.filter((l) => l.type === "blocks").map((l) => l.to));
  return workOf(project)
    .filter((t) => t.startable && isOpen(t))
    .map((ticket) => {
      const parent = parentOf(project, ticket);
      return {
        ...refOf(project),
        ticket,
        feature: parent === undefined ? null : { label: featureLabel(parent), title: parent.title },
        current: sprint !== null && ticket.effectiveSprintId === sprint.id,
        free: !dependents.has(ticket.id),
      };
    })
    .sort(byKey);
}

const activeSteps = <S extends { onHold: unknown }>(steps: readonly S[]): S[] =>
  steps.filter((s) => s.onHold === null);

function riskCount(project: ProjectSnapshot, sprint: SprintView | null, today: string): number {
  if (sprint === null) return 0;
  const { tickets, links } = project;
  return tickets.filter(
    (t) =>
      t.feature !== null &&
      t.sprintId === sprint.id &&
      t.feature.status !== "delivered" &&
      atRisk({ sprint, steps: activeSteps(featureSteps({ feature: t.id, tickets, links })) }, today),
  ).length;
}

function progressOf(project: ProjectSnapshot, today: string): TodayProject["progress"] {
  const work = workOf(project);
  if (project.tickets.length === 0) return null;
  const { delivered, total } = overviewIndicators({ snapshot: project, today }).features;
  return total > 0 ? { done: delivered, total } : { done: work.length - openCount(work), total: work.length };
}

function projectRow(project: ProjectSnapshot, today: string): TodayProject {
  const { id, key, name, color, client } = project.meta;
  const work = workOf(project);
  const sprint = currentSprint(project.sprints, today);
  return {
    id,
    key,
    name,
    color,
    client,
    progress: progressOf(project, today),
    open: openCount(work),
    blocked: blockedCount(work, project.questions),
    risk: riskCount(project, sprint, today),
    sprint: sprint?.code ?? null,
  };
}

const isOpenBlockingQuestion = (q: ProjectSnapshot["questions"][number]): boolean => q.blocking && isOpen(q);

export function todayModel(projects: readonly ProjectSnapshot[], today: string): TodayModel {
  const rows = projects.map((p) => projectRow(p, today));
  const blocked = projects.flatMap(blockedRows);
  const startable = projects.flatMap((p) => startableRows(p, currentSprint(p.sprints, today)));
  return {
    date: today,
    projectCount: projects.length,
    openTickets: rows.reduce((n, p) => n + p.open, 0),
    blocking: [
      ...blocked.filter((b) => b.reason.kind === "question"),
      ...blocked.filter((b) => b.reason.kind === "status"),
    ],
    blockingQuestions: projects.reduce((n, p) => n + p.questions.filter(isOpenBlockingQuestion).length, 0),
    prsToReview: projects.flatMap(prRows).sort((a, b) => prRank(a) - prRank(b) || a.pr.number - b.pr.number),
    startable: [...startable.filter((s) => s.current), ...startable.filter((s) => !s.current)],
    projects: rows,
  };
}
