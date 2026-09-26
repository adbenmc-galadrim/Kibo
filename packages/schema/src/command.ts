import { z } from "zod";
import { ExternalRef, ExternalRefKind } from "./external-ref";
import { NodeId, Sha256 } from "./ids";
import { ComponentRef, DataKey, type Instance, Layout } from "./instance";
import { Binding } from "./integrations";
import type { Link } from "./link";
import type { EntityType } from "./manifest";
import { type Page, PageKind } from "./page";
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
    parentId: NodeId.nullable().optional(),
    assignee: Assignee.nullable().optional(),
  }),
  z.object({
    method: z.literal("updateTicket"),
    ticketId: NodeId,
    title: z.string().optional(),
    description: z.string().optional(),
    domainId: z.string().nullable().optional(),
    assignee: Assignee.nullable().optional(),
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
  z.object({
    method: z.literal("setInstanceData"),
    instanceId: z.string(),
    key: DataKey,
    value: z.unknown(),
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
  setInstanceData: null,
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
  setInstanceData: null;
};
