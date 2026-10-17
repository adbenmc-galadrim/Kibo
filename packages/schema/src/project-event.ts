import { z } from "zod";
import { NodeId } from "./ids";

const ProjectId = z.string().min(1);

export const ProjectEventKind = z.enum([
  "branch_created",
  "pr_opened",
  "pr_review",
  "pr_checks",
  "pr_merged",
  "status_changed",
  "step_set",
  "session_started",
  "session_stopped",
  "sprint_created",
  "sprint_set",
  "batch_proposed",
  "batch_decided",
  "question_created",
  "question_answered",
  "question_reminded",
]);
export type ProjectEventKind = z.infer<typeof ProjectEventKind>;

export const ProjectEventSource = z.enum([
  "git",
  "full-delivery",
  "update-delivery",
  "project-agent",
  "user",
  "kibo",
]);
export type ProjectEventSource = z.infer<typeof ProjectEventSource>;

export const ProjectEventData = z.record(
  z.string(),
  z.union([z.string().max(300), z.number(), z.boolean(), z.null()]),
);
export type ProjectEventData = z.infer<typeof ProjectEventData>;

export const ProjectEventInput = z.object({
  kind: ProjectEventKind,
  ticketId: NodeId.nullable(),
  featureId: NodeId.nullable(),
  source: ProjectEventSource,
  data: ProjectEventData,
});
export type ProjectEventInput = z.infer<typeof ProjectEventInput>;

export const ProjectEvent = ProjectEventInput.extend({
  id: z.number().int(),
  projectId: ProjectId,
  at: z.number().int(),
});
export type ProjectEvent = z.infer<typeof ProjectEvent>;

export type ProjectEventSink = { record(projectId: string, event: ProjectEventInput): void };

export const PROJECT_EVENTS_RETENTION = 5_000;
export const PROJECT_EVENTS_PAGE_MAX = 200;

export const ListProjectEventsInput = z.object({
  projectId: ProjectId,
  limit: z.number().int().min(1).max(PROJECT_EVENTS_PAGE_MAX).default(50),
  before: z.number().int().optional(),
  ticketId: NodeId.optional(),
  featureId: NodeId.optional(),
  sources: z.array(ProjectEventSource).optional(),
});
export type ListProjectEventsInput = z.infer<typeof ListProjectEventsInput>;

export type ProjectEventPage = { items: ProjectEvent[]; nextBefore: number | null };
