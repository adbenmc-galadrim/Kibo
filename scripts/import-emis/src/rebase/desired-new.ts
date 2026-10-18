import {
  type DeliveryKind,
  KiboError,
  type ProjectCommand,
  type ProjectSetup,
  QUESTION_CONTEXT_MAX,
  QUESTION_TITLE_MAX,
} from "@kibo/schema";
import { isPlaced, type Mapping, type NewFeature, type PlacedQuestion } from "./mapping";
import type { OldTicket } from "./old-project";
import type { Scheduled } from "./plan-sprints";

export const REBASE_START = "2026-10-19";

export type PlannedCommand =
  | {
      op: "createProject";
      name: string;
      key: string;
      folder: string | null;
      color: string;
      client: string | null;
      setup: ProjectSetup;
    }
  | { op: "command"; command: ProjectCommand; defines: string | null; expectKey: string | null }
  | { op: "setDeliveryStep"; ticketKey: string; step: number; note: string; kind: DeliveryKind };

export const rebaseSetup = (schedule: readonly Scheduled[]): ProjectSetup => ({
  sprintStart: REBASE_START,
  sprintCount: Math.max(1, ...schedule.map((s) => s.sprint)),
  sprintWeeks: 1,
});

const run = (
  command: ProjectCommand,
  defines: string | null = null,
  expectKey: string | null = null,
): PlannedCommand => ({
  op: "command",
  command,
  defines,
  expectKey,
});
const featureHolder = (f: NewFeature): string => `new:${f.chapter}`;
const stepHolder = (f: NewFeature, index: number): string => `new:${f.chapter}/${index + 1}`;
const withLabels = (labels: readonly string[]) => (labels.length > 0 ? { labels: [...labels] } : {});
const withText = (description: string) => (description.length > 0 ? { description } : {});

function creations(f: NewFeature): PlannedCommand[] {
  const root = run(
    {
      method: "createTicket",
      title: f.title,
      feature: true,
      ...withText(f.ticket.description),
      ...withLabels(f.labels),
    },
    featureHolder(f),
    f.shortKey,
  );
  const steps = f.steps.map((s, i) =>
    run(
      {
        method: "createTicket",
        title: s.title,
        ...withText(s.ticket.description),
        ...withLabels(s.labels),
        parentId: featureHolder(f),
      },
      stepHolder(f, i),
      s.newKey,
    ),
  );
  return [root, ...steps];
}

type Holder = { id: string; ticket: OldTicket; newKey: string; isStep: boolean };

function holders(mapping: Mapping): Holder[] {
  return mapping.features.flatMap((f) => [
    { id: featureHolder(f), ticket: f.ticket, newKey: f.shortKey, isStep: false },
    ...f.steps.map((s, i) => ({ id: stepHolder(f, i), ticket: s.ticket, newKey: s.newKey, isStep: true })),
  ]);
}

function ticketEdits(all: readonly Holder[]): PlannedCommand[] {
  const steps = all.filter((h) => h.isStep);
  const status = steps.flatMap(({ id, ticket }) =>
    ticket.statusId === "todo"
      ? []
      : [
          run({
            method: "setStatus",
            ticketId: id,
            statusId: ticket.statusId,
            ...(ticket.blockedReason ? { reason: ticket.blockedReason } : {}),
          }),
        ],
  );
  const refs = all.flatMap(({ id, ticket }) =>
    ticket.refs.map((ref) => run({ method: "upsertExternalRef", ticketId: id, ref })),
  );
  const optional = steps.flatMap(({ id, ticket }) =>
    ticket.optional ? [run({ method: "setTicketOptional", ticketId: id, optional: true })] : [],
  );
  const delivery = steps.flatMap(({ ticket, newKey }): PlannedCommand[] => {
    const d = ticket.delivery;
    return d ? [{ op: "setDeliveryStep", ticketKey: newKey, step: d.step, note: d.note, kind: d.kind }] : [];
  });
  return [...status, ...refs, ...optional, ...delivery];
}

function questionCommands(
  questions: readonly PlacedQuestion[],
  holderOf: (oldKey: string) => string,
): PlannedCommand[] {
  return questions.filter(isPlaced).flatMap(({ old, ticketOldKey }, i) => {
    const id = `new:q${i + 1}`;
    const created = run(
      {
        method: "createQuestion",
        ticketId: holderOf(ticketOldKey),
        title: old.title.slice(0, QUESTION_TITLE_MAX),
        context: old.context.slice(0, QUESTION_CONTEXT_MAX),
        blocking: old.blocking,
        createdBy: old.createdBy,
        importRef: old.importRef,
        ...(old.recipient ? { recipient: old.recipient } : {}),
      },
      id,
    );
    const a = old.answer;
    const answer = a
      ? [
          run({
            method: "answerQuestion",
            questionId: id,
            answer: { kind: "text", text: a.text },
            by: a.by,
            at: a.at,
          }),
        ]
      : [];
    const archive = old.archived
      ? [run({ method: "archiveQuestion", questionId: id, by: old.createdBy })]
      : [];
    return [created, ...answer, ...archive];
  });
}

function found(holders: ReadonlyMap<string, string>, key: string): string {
  const id = holders.get(key);
  if (id === undefined) throw new KiboError("INVALID_INPUT", `no ticket is planned for ${key}`);
  return id;
}

export function desiredCommands(mapping: Mapping, schedule: readonly Scheduled[]): PlannedCommand[] {
  const { name, key, folder, color, client } = mapping.project;
  const all = holders(mapping);
  const byOldKey = new Map(all.map((h) => [h.ticket.key, h.id]));
  const byNewKey = new Map(all.map((h) => [h.newKey, h.id]));
  const holderOf = (k: string) => found(byOldKey, k);
  const links = mapping.links.map((l) =>
    run({ method: "addLink", from: found(byNewKey, l.from), to: found(byNewKey, l.to), type: l.type }),
  );
  const sprints = schedule.map((s) =>
    run({ method: "setTicketSprint", ticketId: found(byNewKey, s.id), sprintId: `sprint:S${s.sprint}` }),
  );
  return [
    { op: "createProject", name, key, folder, color, client, setup: rebaseSetup(schedule) },
    ...mapping.features.flatMap(creations),
    ...ticketEdits(all),
    ...links,
    ...questionCommands(mapping.questions, holderOf),
    ...sprints,
  ];
}
