import {
  type ExternalRef,
  externalRefKey,
  type GithubPrRef,
  isFeature,
  type ProjectCommand,
  type ProjectEventInput,
  type ProjectEventSource,
  type ProjectSnapshot,
  Question,
  type TicketView,
} from "@kibo/schema";
import type { CommandEvent } from "../docs";

export const TRACKED_METHODS: ReadonlySet<ProjectCommand["method"]> = new Set([
  "setStatus",
  "setTicketSprint",
  "createSprint",
  "upsertExternalRef",
  "setTicketDelivery",
  "createQuestion",
  "answerQuestion",
]);

type Facts = { before: ProjectSnapshot; after: ProjectSnapshot };
type Running = {
  status: Map<string, string>;
  sprint: Map<string, string | null>;
  refs: Map<string, ExternalRef>;
};
type Draft = Omit<ProjectEventInput, "featureId" | "source">;

const TEXT_MAX = 300;
const FOLLOWED: ReadonlySet<string> = new Set(["open", "draft"]);

const sourceOf = (e: CommandEvent): ProjectEventSource => (e.meta.origin === "kibo" ? "kibo" : "user");

export function rootOf(snapshot: ProjectSnapshot, ticketId: string): TicketView | null {
  const byId = new Map(snapshot.tickets.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let current = byId.get(ticketId);
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current ?? null;
}

export function featureIdOf(snapshot: ProjectSnapshot, ticketId: string | null): string | null {
  if (ticketId === null) return null;
  const root = rootOf(snapshot, ticketId);
  if (!root) return null;
  return root.id !== ticketId || isFeature(root) ? root.id : null;
}

const refKey = (ticketId: string, ref: ExternalRef) => `${ticketId}|${ref.kind}|${externalRefKey(ref)}`;

function runningFacts(before: ProjectSnapshot): Running {
  const running: Running = { status: new Map(), sprint: new Map(), refs: new Map() };
  for (const t of before.tickets) {
    running.status.set(t.id, t.statusId);
    running.sprint.set(t.id, t.sprintId);
    for (const ref of t.externalRefs) running.refs.set(refKey(t.id, ref), ref);
  }
  return running;
}

const sprintCode = (facts: Facts, sprintId: string | null): string | null =>
  sprintId === null
    ? null
    : (facts.after.sprints.find((s) => s.id === sprintId)?.code ??
      facts.before.sprints.find((s) => s.id === sprintId)?.code ??
      null);

function prDrafts(ticketId: string, pr: GithubPrRef, previous: GithubPrRef | null): Draft[] {
  const data = { number: pr.number, state: pr.state, review: pr.review, checks: pr.checks };
  const draft = (kind: Draft["kind"]): Draft => ({ kind, ticketId, data });
  if (previous === null || previous.state !== pr.state) {
    if (pr.state === "merged") return [draft("pr_merged")];
    const reopened = FOLLOWED.has(pr.state) && (previous === null || !FOLLOWED.has(previous.state));
    return reopened ? [draft("pr_opened")] : [];
  }
  return [
    ...(previous.review !== pr.review ? [draft("pr_review")] : []),
    ...(previous.checks !== pr.checks ? [draft("pr_checks")] : []),
  ];
}

type RefCommand = Extract<ProjectCommand, { method: "upsertExternalRef" }>;

const branchData = (branch: string, e: CommandEvent): Draft["data"] =>
  e.meta.origin === "user" ? { branch, declared: true } : { branch };

function refDrafts(running: Running, cmd: RefCommand, e: CommandEvent): Draft[] {
  const key = refKey(cmd.ticketId, cmd.ref);
  const previous = running.refs.get(key) ?? null;
  running.refs.set(key, cmd.ref);
  if (cmd.ref.kind === "git_branch")
    return previous === null
      ? [{ kind: "branch_created", ticketId: cmd.ticketId, data: branchData(cmd.ref.branch, e) }]
      : [];
  if (cmd.ref.kind !== "github_pr") return [];
  return prDrafts(cmd.ticketId, cmd.ref, previous?.kind === "github_pr" ? previous : null);
}

function questionDraft(facts: Facts, e: CommandEvent, questionId: string): Draft[] {
  const parsed = Question.safeParse(e.result);
  const question = parsed.success ? parsed.data : facts.after.questions.find((q) => q.id === questionId);
  if (!question) return [];
  const kind = e.command.method === "createQuestion" ? "question_created" : "question_answered";
  return [
    {
      kind,
      ticketId: question.ticketId,
      data: {
        questionId: question.id,
        title: question.title.slice(0, TEXT_MAX),
        ref: (question.importRef?.id ?? question.title).slice(0, TEXT_MAX),
      },
    },
  ];
}

function drafts(facts: Facts, running: Running, e: CommandEvent): Draft[] {
  const cmd = e.command;
  switch (cmd.method) {
    case "setStatus": {
      const from = running.status.get(cmd.ticketId) ?? null;
      running.status.set(cmd.ticketId, cmd.statusId);
      return from === cmd.statusId
        ? []
        : [{ kind: "status_changed", ticketId: cmd.ticketId, data: { from, to: cmd.statusId } }];
    }
    case "setTicketSprint": {
      const from = running.sprint.get(cmd.ticketId) ?? null;
      running.sprint.set(cmd.ticketId, cmd.sprintId);
      if (from === cmd.sprintId) return [];
      const data = { from: sprintCode(facts, from), to: sprintCode(facts, cmd.sprintId) };
      return [{ kind: "sprint_set", ticketId: cmd.ticketId, data }];
    }
    case "createSprint":
      return [{ kind: "sprint_created", ticketId: null, data: { code: cmd.code, name: cmd.name } }];
    case "upsertExternalRef":
      return refDrafts(running, cmd, e);
    case "setTicketDelivery":
      return cmd.delivery === null
        ? []
        : [
            {
              kind: "step_set",
              ticketId: cmd.ticketId,
              data: { step: cmd.delivery.step, note: cmd.delivery.note },
            },
          ];
    case "createQuestion":
      return questionDraft(facts, e, "");
    case "answerQuestion":
      return questionDraft(facts, e, cmd.questionId);
    default:
      return [];
  }
}

function sourceFor(e: CommandEvent): ProjectEventSource {
  const cmd = e.command;
  if (cmd.method === "upsertExternalRef") return "git";
  if (cmd.method === "setTicketDelivery")
    return cmd.delivery?.kind === "update" ? "update-delivery" : "full-delivery";
  return sourceOf(e);
}

export function translate(facts: Facts, done: readonly CommandEvent[]): ProjectEventInput[] {
  const running = runningFacts(facts.before);
  return done.flatMap((e) =>
    drafts(facts, running, e).map((draft) => ({
      ...draft,
      featureId: featureIdOf(facts.after, draft.ticketId),
      source: sourceFor(e),
    })),
  );
}

export function deliveredRoots(facts: Facts): Map<string, string> {
  const delivered = new Map<string, string>();
  const was = new Map(facts.before.tickets.map((t) => [t.id, t.feature?.status ?? null]));
  for (const t of facts.after.tickets)
    if (t.feature?.status === "delivered" && was.get(t.id) !== "delivered")
      delivered.set(t.id, t.shortKey ?? t.keyLabel);
  return delivered;
}

export function markDelivered(events: ProjectEventInput[], delivered: ReadonlyMap<string, string>): void {
  for (const [rootId, label] of delivered) {
    const ofRoot = events.filter((e) => e.featureId === rootId || e.ticketId === rootId);
    const target =
      ofRoot.find((e) => e.kind === "pr_merged") ?? ofRoot.find((e) => e.kind === "status_changed");
    if (target) target.data = { ...target.data, delivered: label };
  }
}
