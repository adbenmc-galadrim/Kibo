import { z } from "zod";
import { NodeId, TicketKey } from "./ids";
import { Labels } from "./label";
import { MAX_NOTE_CHARS, NotePath } from "./note";
import {
  Actor,
  AnswerInput,
  QUESTION_CONTEXT_MAX,
  QUESTION_OPTIONS_MAX,
  QuestionOption,
  QuestionTitle,
} from "./question";
import type { RunView } from "./run";
import { StatusId } from "./status";

export const PROJECT_AGENT_PROFILE_ID = "project-agent";
export const MEMORY_NOTE_PATH = "agent-de-projet/memoire.md";
export const BATCH_SUMMARY_MAX = 2_000;
export const WHY_MAX = 300;
export const BATCH_COMMENT_MAX = 4_000;
export const ACTION_TITLE_MAX = 200;
export const ACTION_DESCRIPTION_MAX = 20_000;
export const ACTION_BRIEF_MAX = 4_000;
export const ACTION_DETAIL_MAX = 1_000;

export const NewRef = z.string().regex(/^new:[1-9]\d{0,3}$/);
export const TicketRef = z.union([TicketKey, NewRef]);
export type TicketRef = z.infer<typeof TicketRef>;
export const LinkKind = z.enum(["blocks", "relates"]);
export type LinkKind = z.infer<typeof LinkKind>;
export const ActionId = z.number().int().positive();

const base = { id: ActionId, why: z.string().trim().max(WHY_MAX) };
const ActionTitle = z.string().trim().min(1).max(ACTION_TITLE_MAX);
const ActionDescription = z.string().max(ACTION_DESCRIPTION_MAX);
const NoteBody = z.string().max(MAX_NOTE_CHARS);

export const ProposedAction = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("createTicket"),
    ref: NewRef,
    title: ActionTitle,
    description: ActionDescription.optional(),
    statusId: StatusId.optional(),
    blockedReason: z.string().optional(),
    labels: Labels.optional(),
    parent: TicketRef.optional(),
  }),
  z.object({
    ...base,
    type: z.literal("updateTicket"),
    ticket: TicketRef,
    title: ActionTitle.optional(),
    description: ActionDescription.optional(),
    labels: Labels.optional(),
    parent: TicketRef.nullable().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("setStatus"),
    ticket: TicketRef,
    statusId: StatusId,
    blockedReason: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("link"), from: TicketRef, to: TicketRef, kind: z.literal("blocks") }),
  z.object({ ...base, type: z.literal("unlink"), from: TicketRef, to: TicketRef, kind: LinkKind }),
  z.object({
    ...base,
    type: z.literal("assignAgent"),
    ticket: TicketRef,
    profileId: z.string().min(1),
    brief: z.string().max(ACTION_BRIEF_MAX).optional(),
    fresh: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("deliverAnswers"), ticket: TicketRef }),
  z.object({ ...base, type: z.literal("cancelRun"), runId: z.string().min(1) }),
  z.object({ ...base, type: z.literal("answerQuestion"), questionId: NodeId, answer: AnswerInput }),
  z.object({
    ...base,
    type: z.literal("createQuestion"),
    ticket: TicketRef,
    title: QuestionTitle,
    context: z.string().max(QUESTION_CONTEXT_MAX).optional(),
    options: z.array(QuestionOption).max(QUESTION_OPTIONS_MAX).optional(),
    provisional: QuestionOption.optional(),
    blocking: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("createNote"), path: NotePath, content: NoteBody }),
  z.object({ ...base, type: z.literal("updateNote"), path: NotePath, content: NoteBody }),
]);
export type ProposedAction = z.infer<typeof ProposedAction>;
export type ActionType = ProposedAction["type"];
export type ActionGroup = "tickets" | "agents" | "questions" | "notes";

export const ACTION_GROUPS: Record<ActionType, ActionGroup> = {
  createTicket: "tickets",
  updateTicket: "tickets",
  setStatus: "tickets",
  link: "tickets",
  unlink: "tickets",
  assignAgent: "agents",
  deliverAnswers: "agents",
  cancelRun: "agents",
  answerQuestion: "questions",
  createQuestion: "questions",
  createNote: "notes",
  updateNote: "notes",
};

export const ProposeBatchInput = z.object({
  summary: z.string().trim().min(1).max(BATCH_SUMMARY_MAX),
  actions: z.array(ProposedAction).min(1),
});
export type ProposeBatchInput = z.infer<typeof ProposeBatchInput>;

export const BatchStatus = z.enum(["pending", "applied", "partial", "rejected", "superseded", "abandoned"]);
export type BatchStatus = z.infer<typeof BatchStatus>;
export const ActionOutcome = z.enum(["applied", "stale", "failed", "skipped"]);
export type ActionOutcome = z.infer<typeof ActionOutcome>;

export const ActionResult = z.object({
  actionId: ActionId,
  outcome: ActionOutcome,
  detail: z.string().max(ACTION_DETAIL_MAX).nullable(),
  created: z.object({ ticketId: NodeId, key: TicketKey }).nullable().default(null),
});
export type ActionResult = z.infer<typeof ActionResult>;

export const ExpectedState = z.object({ actionId: ActionId, fields: z.record(z.string(), z.unknown()) });
export type ExpectedState = z.infer<typeof ExpectedState>;

export const BatchDecisionKind = z.enum(["apply", "reject"]);
export type BatchDecisionKind = z.infer<typeof BatchDecisionKind>;

export const BatchEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("decided"),
    decision: BatchDecisionKind,
    by: Actor,
    actionIds: z.array(ActionId).nullable(),
    comment: z.string().max(BATCH_COMMENT_MAX).nullable(),
  }),
  z.object({ type: z.literal("results"), results: z.array(ActionResult) }),
  z.object({ type: z.literal("superseded") }),
  z.object({ type: z.literal("abandoned") }),
]);
export type BatchEvent = z.infer<typeof BatchEvent>;

export type BatchRow = {
  id: string;
  projectId: string;
  runId: string;
  sessionId: string;
  seq: number;
  summary: string;
  actions: ProposedAction[];
  expected: ExpectedState[];
  createdAt: number;
};

export type Batch = BatchRow & {
  status: BatchStatus;
  decidedBy: Actor | null;
  decidedAt: number | null;
  chosen: number[] | null;
  comment: string | null;
  results: ActionResult[];
};

export type TimedBatchEvent = { at: number; event: BatchEvent };

export function batchStatusOfResults(results: readonly ActionResult[]): "applied" | "partial" {
  return results.every((r) => r.outcome === "applied") ? "applied" : "partial";
}

function foldEvent(batch: Batch, { at, event }: TimedBatchEvent): Batch {
  switch (event.type) {
    case "decided":
      return {
        ...batch,
        status: event.decision === "reject" ? "rejected" : "partial",
        decidedBy: event.by,
        decidedAt: at,
        chosen: event.decision === "apply" ? event.actionIds : null,
        comment: event.comment,
      };
    case "results":
      return { ...batch, status: batchStatusOfResults(event.results), results: event.results };
    case "superseded":
      return { ...batch, status: "superseded" };
    case "abandoned":
      return { ...batch, status: "abandoned" };
  }
}

export function foldBatch(row: BatchRow, events: readonly TimedBatchEvent[]): Batch {
  const initial: Batch = {
    ...row,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    chosen: null,
    comment: null,
    results: [],
  };
  return events.reduce(foldEvent, initial);
}

export const isDecidable = (b: Pick<Batch, "status">): boolean => b.status === "pending";

export type ProjectAgentSession = {
  projectId: string;
  runId: string;
  sessionId: string;
  startedAt: number;
  closedAt: number | null;
  lastTurnAt: number | null;
};

export type ProjectAgentView = {
  session: ProjectAgentSession | null;
  run: RunView | null;
  batches: Batch[];
  past: ProjectAgentSession[];
  memoryPath: string;
};
