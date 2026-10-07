import {
  type ExternalRef,
  GitBranchName,
  type ImportRef,
  normalizeLabels,
  type PrInfo,
  type StatusId,
} from "@kibo/schema";
import {
  firstSentence,
  parseTodo,
  renderDescription,
  slugify,
  stripInlineMarkup,
  truncate,
} from "./markdown";
import {
  type Answers,
  type EmisPlan,
  type FlatPr,
  flatPrs,
  type PlanQuestion,
  type PlanStatus,
} from "./plan-source";

export type DesiredTicket = {
  ref: ImportRef;
  title: string;
  description: string;
  statusId: StatusId;
  blockedReason: string | null;
  labels: string[];
  parent: ImportRef | null;
  refs: ExternalRef[];
};
export type DesiredLink = { from: ImportRef; to: ImportRef };
export type TicketInput = {
  plan: EmisPlan;
  answers: Answers;
  todo: string | null;
  repoUrl: string;
  prs: Map<number, PrInfo>;
};

const TITLE_MAX = 80;
const NO_BLOCKS = "—";
const DEFAULT_BLOCKED = "Bloquée dans le plan Emis";
const STATUS: Record<PlanStatus, StatusId> = {
  todo: "todo",
  wip: "in_progress",
  review: "in_review",
  done: "done",
  blocked: "blocked",
};

export const importRef = (source: string, id: string): ImportRef => ({ kind: "import_ref", source, id });
export const refKey = (ref: ImportRef): string => `${ref.source}:${ref.id}`;
const planRef = (id: string) => importRef("plan", id);

function parentTicket(
  id: string,
  title: string,
  description: string,
  parent: ImportRef | null,
): DesiredTicket {
  return {
    ref: planRef(id),
    title,
    description,
    statusId: "todo",
    blockedReason: null,
    labels: [],
    parent,
    refs: [],
  };
}

const questionTitle = (q: PlanQuestion) => `${q.ref} · ${truncate(stripInlineMarkup(q.question), TITLE_MAX)}`;
const isAnswered = (q: PlanQuestion, answers: Answers) => q.resolved || answers[q.ref]?.status === "answered";

function blockedReason(pr: FlatPr, input: TicketInput): string {
  const note = pr.note?.trim();
  if (note) return note;
  const question = input.plan.arbitrages
    .flatMap((g) => g.items)
    .find((q) => q.blocks === pr.id && !isAnswered(q, input.answers));
  return question ? questionTitle(question) : DEFAULT_BLOCKED;
}

function prRefs(pr: FlatPr, byId: Map<string, FlatPr>, input: TicketInput): ExternalRef[] {
  const refs: ExternalRef[] = [];
  if (pr.pr !== undefined && pr.pr !== null) {
    const info = input.prs.get(pr.pr);
    refs.push(
      info
        ? {
            kind: "github_pr",
            url: info.url,
            number: info.number,
            state: info.state,
            base: info.base,
            head: info.head,
          }
        : {
            kind: "github_pr",
            url: `${input.repoUrl}/pull/${pr.pr}`,
            number: pr.pr,
            state: "open",
            base: null,
            head: null,
          },
    );
  }
  if (pr.branch) {
    const stacked = pr.deps.map((d) => byId.get(d)).find((d) => d && d.status !== "done" && d.branch);
    const base = stacked?.branch ?? null;
    refs.push({
      kind: "git_branch",
      branch: GitBranchName.parse(pr.branch),
      base: base === null ? null : GitBranchName.parse(base),
    });
  }
  return refs;
}

function prTicket(pr: FlatPr, byId: Map<string, FlatPr>, input: TicketInput): DesiredTicket {
  const statusId = STATUS[pr.status];
  return {
    ref: planRef(pr.id),
    title: `${pr.id} · ${pr.title}`,
    description: renderDescription(pr),
    statusId,
    blockedReason: statusId === "blocked" ? blockedReason(pr, input) : null,
    labels: normalizeLabels([
      `phase:${pr.phase.toLowerCase()}`,
      `sprint:${pr.sprint.toLowerCase()}`,
      ...pr.areas.map((a) => `area:${a.toLowerCase()}`),
    ]),
    parent: planRef(pr.chapter),
    refs: prRefs(pr, byId, input),
  };
}

function chapterTickets(input: TicketInput): DesiredTicket[] {
  const byId = new Map(flatPrs(input.plan).map((p) => [p.id, p]));
  return input.plan.chapters.flatMap((c) => [
    parentTicket(c.id, `${c.id} · ${c.title}`, c.tagline, null),
    ...c.prs.map((p) => prTicket({ ...p, chapter: c.id }, byId, input)),
  ]);
}

function questionTicket(
  q: PlanQuestion,
  group: { group: string; tone: string },
  parent: ImportRef,
  answers: Answers,
): DesiredTicket {
  const answer = answers[q.ref]?.answer.trim();
  const done = isAnswered(q, answers);
  return {
    ref: planRef(q.ref),
    title: questionTitle(q),
    description: answer ? `${q.question}\n\n## Réponse\n\n${answer}\n` : `${q.question}\n`,
    statusId: done ? "done" : "blocked",
    blockedReason: done ? null : `Attend une réponse (${group.group})`,
    labels: normalizeLabels([`question:${slugify(group.tone)}`]),
    parent,
    refs: [],
  };
}

function arbitrageTickets(input: TicketInput): DesiredTicket[] {
  const root = parentTicket(
    "arbitrages",
    "Arbitrages",
    "Questions ouvertes du plan Emis, par groupe.\n",
    null,
  );
  return [
    root,
    ...input.plan.arbitrages.flatMap((g) => {
      const group = parentTicket(`arbitrages/${slugify(g.group)}`, g.group, "", root.ref);
      return [group, ...g.items.map((q) => questionTicket(q, g, group.ref, input.answers))];
    }),
  ];
}

function todoTickets(todo: string | null): DesiredTicket[] {
  if (todo === null) return [];
  const root = parentTicket("todo", "TODO", "Points du TODO d'Emis.\n", null);
  return [
    root,
    ...parseTodo(todo).map((item) => ({
      ref: importRef("todo", item.code),
      title: `${item.code} · ${truncate(firstSentence(stripInlineMarkup(item.text)), TITLE_MAX)}`,
      description: `${item.text}\n`,
      statusId: "todo" as const,
      blockedReason: null,
      labels: normalizeLabels([`priority:${item.level}`, ...(item.pending ? ["decision:pending"] : [])]),
      parent: root.ref,
      refs: [],
    })),
  ];
}

export function desiredTickets(input: TicketInput): DesiredTicket[] {
  return [...chapterTickets(input), ...arbitrageTickets(input), ...todoTickets(input.todo)];
}

export function desiredLinks(plan: EmisPlan): DesiredLink[] {
  const prs = flatPrs(plan);
  const known = new Set(prs.map((p) => p.id));
  return [
    ...prs.flatMap((p) => p.deps.map((d) => ({ from: planRef(d), to: planRef(p.id) }))),
    ...plan.arbitrages
      .flatMap((g) => g.items)
      .filter((q) => q.blocks !== NO_BLOCKS && known.has(q.blocks))
      .map((q) => ({ from: planRef(q.ref), to: planRef(q.blocks) })),
  ];
}
