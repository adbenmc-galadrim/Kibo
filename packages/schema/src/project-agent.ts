import { z } from "zod";
import { HoldReason } from "./hold";
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
import { QuestionRecipient, RECIPIENT_ID_MAX } from "./question-recipient";
import type { RunView } from "./run";
import { ActionId, SIGNAL_REFS_MAX, SignalRef } from "./signal";
import { SprintCode, SprintDate, SprintName } from "./sprint";
import { StatusId } from "./status";

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
export { ActionId };

const base = {
  id: ActionId,
  why: z.string().trim().max(WHY_MAX),
  signals: z.array(SignalRef).max(SIGNAL_REFS_MAX).optional(),
};
const ActionTitle = z.string().trim().min(1).max(ACTION_TITLE_MAX);
const ActionDescription = z.string().max(ACTION_DESCRIPTION_MAX);
const NoteBody = z.string().max(MAX_NOTE_CHARS);
const RecipientName = z.string().trim().min(1).max(RECIPIENT_ID_MAX);

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
    recipient: RecipientName.optional(),
  }),
  z
    .object({
      ...base,
      type: z.literal("updateQuestion"),
      questionId: NodeId,
      title: QuestionTitle.optional(),
      context: z.string().max(QUESTION_CONTEXT_MAX).optional(),
      options: z.array(QuestionOption).max(QUESTION_OPTIONS_MAX).optional(),
      provisional: QuestionOption.optional(),
      ticket: TicketRef.optional(),
      recipient: RecipientName.optional(),
    })
    .strict(),
  z.object({ ...base, type: z.literal("reopenQuestion"), questionId: NodeId }),
  z.object({ ...base, type: z.literal("deleteQuestion"), questionId: NodeId }),
  z.object({ ...base, type: z.literal("addRecipient"), name: QuestionRecipient.shape.name }),
  z.object({ ...base, type: z.literal("createNote"), path: NotePath, content: NoteBody }),
  z.object({ ...base, type: z.literal("updateNote"), path: NotePath, content: NoteBody }),
  z.object({ ...base, type: z.literal("dismissSignal"), signal: SignalRef }),
  z.object({ ...base, type: z.literal("setSprint"), ticket: TicketRef, sprint: SprintCode.nullable() }),
  z.object({
    ...base,
    type: z.literal("createSprint"),
    code: SprintCode,
    name: SprintName,
    start: SprintDate,
    end: SprintDate,
  }),
  z.object({ ...base, type: z.literal("remindQuestion"), questionId: NodeId }),
  z.object({ ...base, type: z.literal("setHold"), ticket: TicketRef, reason: HoldReason.nullable() }),
]);
export type ProposedAction = z.infer<typeof ProposedAction>;
export type ActionType = ProposedAction["type"];
export type ActionGroup = "tickets" | "sprints" | "agents" | "questions" | "notes" | "signals";

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
  updateQuestion: "questions",
  reopenQuestion: "questions",
  deleteQuestion: "questions",
  addRecipient: "questions",
  createNote: "notes",
  updateNote: "notes",
  dismissSignal: "signals",
  setSprint: "sprints",
  createSprint: "sprints",
  remindQuestion: "questions",
  setHold: "tickets",
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
    keepRest: z.boolean().optional(),
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

export type ProjectAgentSession = {
  projectId: string;
  runId: string;
  sessionId: string;
  startedAt: number;
  closedAt: number | null;
  lastTurnAt: number | null;
};

export type ProjectAgentSessionView = ProjectAgentSession & { title: string | null; messages: number };

export type ProjectAgentView = {
  session: ProjectAgentSessionView | null;
  run: RunView | null;
  batches: Batch[];
  past: ProjectAgentSessionView[];
  memoryPath: string;
};
