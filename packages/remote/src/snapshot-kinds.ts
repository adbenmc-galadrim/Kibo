import type { Batch, Page, ProjectAgentView, RunLogEntry } from "@kibo/schema";
import { z } from "zod";

export const SnapshotKind = z.union([
  z.enum(["projects", "project", "events", "agent", "ci", "t3"]),
  z.string().regex(/^image:[^:]+:[^:]+$/),
]);
export type SnapshotKind = z.infer<typeof SnapshotKind>;

export const INDEX_PROJECT_ID = "_";

export type ProjectsIndex = {
  viewer: string;
  projects: { id: string; name: string; key: string; icon: string | null; pages: Page[] }[];
};
export type AgentSnapshot = {
  view: ProjectAgentView;
  logs: Record<string, RunLogEntry[]>;
  pastBatches?: Record<string, Batch[]>;
};
export type ImageSnapshot = { mime: string; bytes: string };
