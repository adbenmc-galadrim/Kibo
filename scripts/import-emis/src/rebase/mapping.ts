import { type Actor, type ImportRef, KiboError, QUESTION_TITLE_MAX } from "@kibo/schema";
import type { OldLink, OldMeta, OldProject, OldQuestion, OldTicket } from "./old-project";
import { questionTarget, UNPLACED } from "./question-placement";
import type { TodoPlacement } from "./todo-placement";

export type NewStep = {
  newKey: string;
  oldKey: string;
  title: string;
  fromTodo: boolean;
  labels: string[];
  ticket: OldTicket;
};
export type NewFeature = {
  shortKey: string;
  chapter: string;
  title: string;
  oldKey: string;
  labels: string[];
  ticket: OldTicket;
  steps: NewStep[];
};
export type PlacedQuestion = { old: OldQuestion; ticketOldKey: string };
export type NewLink = { from: string; to: string; type: OldLink["type"] };
export type DroppedLink = OldLink & { why: string };
export type Mapping = {
  project: OldMeta;
  features: NewFeature[];
  keys: Map<string, string>;
  dropped: { oldKey: string; why: string }[];
  questions: PlacedQuestion[];
  links: NewLink[];
  droppedLinks: DroppedLink[];
};

export const CHAPTER_ORDER: readonly string[] = [
  "C0",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "CR",
  "CN",
  "CP",
  "CE",
  "CL",
];
export const TODO_ROOT = "todo";
export const ARBITRAGES_ROOT = "arbitrages";
const TODO_ACTOR: Actor = { kind: "import", ref: "todo" };
const DROPPED_ROOT: Record<string, string> = {
  [ARBITRAGES_ROOT]: "Arbitrages n'est pas une fonctionnalité : ses questions rejoignent leur ticket",
  [TODO_ROOT]: "TODO n'est pas une fonctionnalité : ses tickets rejoignent leur fonctionnalité",
};

export const stripChapterPrefix = (title: string): string => title.replace(/^C[0-9A-Z]*(-[0-9]+)? · /, "");
const stripTodoPrefix = (title: string): string => title.replace(/^[A-Z]+-[0-9]+ · /, "");
const keptLabels = (labels: readonly string[]): string[] =>
  labels.filter((l) => !l.startsWith("sprint:") && !l.startsWith("phase:"));

const todoIdOf = (t: OldTicket): string =>
  t.refs.find((r): r is ImportRef => r.kind === "import_ref" && r.source === "todo")?.id ??
  t.title.split(" · ")[0] ??
  t.key;

type Draft = { root: OldTicket; steps: { ticket: OldTicket; fromTodo: boolean }[] };

function rootsOf(old: OldProject): Map<string, OldTicket> {
  const roots = new Map<string, OldTicket>();
  for (const t of old.tickets) {
    if (t.parentKey !== null) continue;
    const id = t.planId ?? "";
    if (!CHAPTER_ORDER.includes(id) && !(id in DROPPED_ROOT))
      throw new KiboError(
        "INVALID_INPUT",
        `root ${t.key} « ${t.title} » is neither a chapter, TODO nor Arbitrages`,
      );
    roots.set(id, t);
  }
  return roots;
}

function childrenOf(old: OldProject, root: OldTicket | undefined): OldTicket[] {
  if (root === undefined) return [];
  return old.tickets.filter((t) => t.parentKey === root.key).sort((a, b) => a.rank - b.rank);
}

function assertTwoLevels(old: OldProject, roots: ReadonlyMap<string, OldTicket>): void {
  const rootKeys = new Set([...roots.values()].map((r) => r.key));
  const deep = old.tickets.find((t) => t.parentKey !== null && !rootKeys.has(t.parentKey));
  if (deep) throw new KiboError("INVALID_INPUT", `${deep.key} is nested below a step`);
}

function todoQuestion(t: OldTicket): OldQuestion {
  return {
    id: t.id,
    ticketKey: t.key,
    title: stripTodoPrefix(t.title).slice(0, QUESTION_TITLE_MAX),
    context: t.description,
    blocking: true,
    importRef: { kind: "import_ref", source: "todo", id: todoIdOf(t) },
    recipient: "client",
    createdBy: TODO_ACTOR,
    answer: null,
    archived: false,
  };
}

function numbered(drafts: readonly Draft[], projectKey: string): NewFeature[] {
  let seq = 0;
  return drafts.map((d, i) => ({
    shortKey: `F${i + 1}`,
    chapter: d.root.planId ?? "",
    title: stripChapterPrefix(d.root.title),
    oldKey: d.root.key,
    labels: keptLabels(d.root.labels),
    ticket: d.root,
    steps: d.steps.map(({ ticket, fromTodo }) => {
      seq += 1;
      const title = fromTodo ? stripTodoPrefix(ticket.title) : stripChapterPrefix(ticket.title);
      const labels = keptLabels(ticket.labels);
      return { newKey: `${projectKey}-${seq}`, oldKey: ticket.key, title, fromTodo, labels, ticket };
    }),
  }));
}

function remapLinks(old: OldProject, keys: ReadonlyMap<string, string>, questionKeys: ReadonlySet<string>) {
  const links: NewLink[] = [];
  const droppedLinks: DroppedLink[] = [];
  for (const l of old.links) {
    const from = keys.get(l.fromKey);
    const to = keys.get(l.toKey);
    if (from !== undefined && to !== undefined) {
      links.push({ from, to, type: l.type });
      continue;
    }
    const lost = from === undefined ? l.fromKey : l.toKey;
    const why = questionKeys.has(lost) ? `${lost} devient une question` : `${lost} n'est pas recréé`;
    droppedLinks.push({ ...l, why });
  }
  return { links, droppedLinks };
}

export function mapProject(
  old: OldProject,
  placement: TodoPlacement,
  overrides: Readonly<Record<string, string>>,
): Mapping {
  const roots = rootsOf(old);
  assertTwoLevels(old, roots);
  const drafts: Draft[] = CHAPTER_ORDER.flatMap((c) => {
    const root = roots.get(c);
    return root
      ? [{ root, steps: childrenOf(old, root).map((ticket) => ({ ticket, fromTodo: false })) }]
      : [];
  });
  const dropped = [...roots.entries()]
    .filter(([id]) => id in DROPPED_ROOT)
    .map(([id, t]) => ({ oldKey: t.key, why: DROPPED_ROOT[id] ?? "" }));
  const todoQuestions: PlacedQuestion[] = [];
  for (const t of childrenOf(old, roots.get(TODO_ROOT))) {
    const id = todoIdOf(t);
    const place = placement[id];
    const draft = drafts.find((d) => d.root.planId === place?.feature);
    if (place === undefined || draft === undefined) {
      dropped.push({ oldKey: t.key, why: `à placer : ${id} absent de todo-placement.ts` });
    } else if (place.as === "question") {
      todoQuestions.push({ old: todoQuestion(t), ticketOldKey: draft.root.key });
    } else {
      draft.steps.push({ ticket: t, fromTodo: true });
    }
  }
  const features = numbered(drafts, old.project.key);
  const keys = new Map<string, string>();
  for (const f of features) {
    keys.set(f.oldKey, f.shortKey);
    for (const s of f.steps) keys.set(s.oldKey, s.newKey);
  }
  const kept = old.tickets.filter((t) => keys.has(t.key));
  const asQuestion = new Map(todoQuestions.map((q) => [q.old.ticketKey, q.ticketOldKey]));
  const placed = old.questions.map((q) => ({
    old: q,
    ticketOldKey: keys.has(q.ticketKey)
      ? q.ticketKey
      : (asQuestion.get(q.ticketKey) ?? questionTarget(q, { kept, overrides })),
  }));
  const questionKeys = new Set(asQuestion.keys());
  return {
    project: old.project,
    features,
    keys,
    dropped,
    questions: [...todoQuestions, ...placed],
    ...remapLinks(old, keys, questionKeys),
  };
}

export const isPlaced = (q: PlacedQuestion): boolean => q.ticketOldKey !== UNPLACED;
