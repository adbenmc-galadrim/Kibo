import { z } from "zod";
import { ExternalRef, ExternalRefKind } from "./external-ref";
import { ImportRef } from "./git-branch";
import { NodeId, Sha256 } from "./ids";
import { ComponentRef, DataKey, type Instance, Layout } from "./instance";
import { Binding } from "./integrations";
import { Labels } from "./label";
import type { Link } from "./link";
import type { EntityType } from "./manifest";
import { type Page, PageKind } from "./page";
import {
  Actor,
  AnswerInput,
  QUESTION_CONTEXT_MAX,
  QUESTION_OPTIONS_MAX,
  QUESTIONS_PER_TICKET_MAX,
  type Question,
  QuestionOption,
  QuestionTitle,
} from "./question";
import { StatusId } from "./status";
import { Assignee, type Ticket } from "./ticket";

const index = z.number().int().nonnegative().optional();
const JsonRecord = z.record(z.string(), z.unknown());

export const ProjectCommand = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("addPage"),
    title: z.string(),
    kind: PageKind,
    parentId: NodeId.nullable().optional(),
  }),
  z.object({ method: z.literal("renamePage"), pageId: NodeId, title: z.string() }),
  z.object({ method: z.literal("movePage"), pageId: NodeId, parentId: NodeId.nullable(), index }),
  z.object({ method: z.literal("deletePage"), pageId: NodeId }),
  z.object({
    method: z.literal("createTicket"),
    title: z.string(),
    description: z.string().optional(),
    statusId: StatusId.optional(),
    blockedReason: z.string().optional(),
    parentId: NodeId.nullable().optional(),
    assignee: Assignee.nullable().optional(),
    labels: Labels.optional(),
  }),
  z.object({
    method: z.literal("updateTicket"),
    ticketId: NodeId,
    title: z.string().optional(),
    description: z.string().optional(),
    domainId: z.string().nullable().optional(),
    assignee: Assignee.nullable().optional(),
    labels: Labels.optional(),
  }),
  z.object({
    method: z.literal("setStatus"),
    ticketId: NodeId,
    statusId: StatusId,
    reason: z.string().optional(),
  }),
  z.object({ method: z.literal("moveTicket"), ticketId: NodeId, parentId: NodeId.nullable(), index }),
  z.object({ method: z.literal("deleteTicket"), ticketId: NodeId }),
  z.object({ method: z.literal("addLink"), from: NodeId, to: NodeId, type: z.enum(["blocks", "relates"]) }),
  z.object({ method: z.literal("removeLink"), linkId: z.string() }),
  z.object({
    method: z.literal("addInstance"),
    pageId: NodeId,
    component: ComponentRef,
    layout: Layout.optional(),
    config: JsonRecord.optional(),
    componentHash: Sha256.nullable().optional(),
  }),
  z.object({ method: z.literal("removeInstance"), instanceId: z.string() }),
  z.object({ method: z.literal("upsertExternalRef"), ticketId: NodeId, ref: ExternalRef }),
  z.object({
    method: z.literal("removeExternalRef"),
    ticketId: NodeId,
    kind: ExternalRefKind,
    key: z.string().min(1),
  }),
  z.object({ method: z.literal("addBinding"), binding: Binding }),
  z.object({ method: z.literal("removeBinding"), bindingId: z.string().min(1) }),
  z.object({
    method: z.literal("importExternalTicket"),
    title: z.string(),
    description: z.string().optional(),
    statusId: StatusId.optional(),
    assignee: Assignee.nullable().optional(),
    ref: ExternalRef,
  }),
  z.object({
    method: z.literal("setInstanceComponent"),
    instanceId: z.string(),
    component: ComponentRef,
    config: JsonRecord,
    data: JsonRecord.nullable(),
    componentHash: Sha256.nullable().optional(),
  }),
  z.object({ method: z.literal("setInstanceConfig"), instanceId: z.string(), config: JsonRecord }),
  z.object({ method: z.literal("setInstanceLayout"), instanceId: z.string(), layout: Layout }),
  z.object({
    method: z.literal("setPageLayout"),
    pageId: NodeId,
    layouts: z.array(z.object({ instanceId: z.string(), layout: Layout })).max(200),
  }),
  z.object({
    method: z.literal("setInstanceData"),
    instanceId: z.string(),
    key: DataKey,
    value: z.unknown(),
  }),
  z.object({
    method: z.literal("createQuestion"),
    ticketId: NodeId,
    title: QuestionTitle,
    context: z.string().max(QUESTION_CONTEXT_MAX).optional(),
    options: z.array(QuestionOption).max(QUESTION_OPTIONS_MAX).optional(),
    provisional: QuestionOption.nullable().optional(),
    blocking: z.boolean().optional(),
    runId: z.string().min(1).nullable().optional(),
    createdBy: Actor,
    importRef: ImportRef.nullable().optional(),
  }),
  z.object({
    method: z.literal("answerQuestion"),
    questionId: NodeId,
    answer: AnswerInput,
    by: Actor,
    at: z.number().int().optional(),
  }),
  z.object({ method: z.literal("removeQuestion"), questionId: NodeId }),
  z.object({
    method: z.literal("markAnswersDelivered"),
    ticketId: NodeId,
    questionIds: z.array(NodeId).min(1).max(QUESTIONS_PER_TICKET_MAX),
    runId: z.string().min(1),
    at: z.number().int(),
  }),
]);
export type ProjectCommand = z.infer<typeof ProjectCommand>;

export const COMMAND_WRITES: Record<ProjectCommand["method"], EntityType | null> = {
  addPage: "page",
  renamePage: "page",
  movePage: "page",
  deletePage: "page",
  createTicket: "ticket",
  updateTicket: "ticket",
  setStatus: "ticket",
  moveTicket: "ticket",
  deleteTicket: "ticket",
  addLink: "link",
  removeLink: "link",
  addInstance: null,
  removeInstance: null,
  upsertExternalRef: null,
  removeExternalRef: null,
  addBinding: null,
  removeBinding: null,
  importExternalTicket: null,
  setInstanceComponent: null,
  setInstanceConfig: null,
  setInstanceLayout: null,
  setPageLayout: null,
  setInstanceData: null,
  createQuestion: "question",
  answerQuestion: "question",
  removeQuestion: "question",
  markAnswersDelivered: null,
};

export const isReservedCommand = (method: ProjectCommand["method"]): boolean =>
  COMMAND_WRITES[method] === null;

export type CommandResult = {
  addPage: Page;
  renamePage: null;
  movePage: null;
  deletePage: string[];
  createTicket: Ticket;
  updateTicket: Ticket;
  setStatus: Ticket;
  moveTicket: null;
  deleteTicket: string[];
  addLink: Link;
  removeLink: null;
  addInstance: Instance;
  removeInstance: null;
  upsertExternalRef: Ticket;
  removeExternalRef: Ticket;
  addBinding: Binding;
  removeBinding: null;
  importExternalTicket: Ticket;
  setInstanceComponent: Instance;
  setInstanceConfig: Instance;
  setInstanceLayout: Instance;
  setPageLayout: Instance[];
  setInstanceData: null;
  createQuestion: Question;
  answerQuestion: Question;
  removeQuestion: null;
  markAnswersDelivered: Question[];
};
