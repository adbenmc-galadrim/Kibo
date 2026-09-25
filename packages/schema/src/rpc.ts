import { z } from "zod";
import type { KiboErrorCode } from "./errors";
import { NodeId, ProjectKey } from "./ids";
import { ComponentRef, type Instance, Layout } from "./instance";
import type { Link } from "./link";
import { type Page, PageKind } from "./page";
import type { ProjectMeta } from "./project";
import { type Status, StatusId } from "./status";
import { Assignee, type Ticket } from "./ticket";

const index = z.number().int().nonnegative().optional();

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
    config: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({ method: z.literal("removeInstance"), instanceId: z.string() }),
]);
export type ProjectCommand = z.infer<typeof ProjectCommand>;

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
};

export type TicketView = Ticket & { progress: { done: number; total: number }; waitingOn: string[] };
export type ProjectSnapshot = {
  meta: ProjectMeta;
  workflow: Status[];
  pages: Page[];
  tickets: TicketView[];
  links: Link[];
  instances: Instance[];
  nextTicketKey: string;
};
export type ProjectSummary = ProjectMeta & { counts: Record<StatusId, number> };
export type Session = { user: string };

export const RpcRequest = z.discriminatedUnion("method", [
  z.object({ method: z.literal("getSession") }),
  z.object({ method: z.literal("listProjects") }),
  z.object({
    method: z.literal("createProject"),
    name: z.string().trim().min(1),
    key: ProjectKey,
    folder: z.string().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  z.object({ method: z.literal("getProject"), projectId: z.string().min(1) }),
  z.object({ method: z.literal("command"), projectId: z.string().min(1), command: ProjectCommand }),
]);
export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcResult = {
  getSession: Session;
  listProjects: ProjectSummary[];
  createProject: ProjectMeta;
  getProject: ProjectSnapshot;
  command: unknown;
};

export type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: KiboErrorCode; message: string } };
