import { z } from "zod";
import type { ComponentRef } from "./instance";
import { SprintDate } from "./sprint";

export const SPRINT_COUNT_MAX = 52;

export const SprintWeeks = z.union([z.literal(1), z.literal(2)]);
export type SprintWeeks = z.infer<typeof SprintWeeks>;

export const ProjectSetup = z
  .object({
    sprintStart: SprintDate,
    sprintCount: z.number().int().min(1).max(SPRINT_COUNT_MAX),
    sprintWeeks: SprintWeeks,
  })
  .strict();
export type ProjectSetup = z.infer<typeof ProjectSetup>;

export type SetupPage = {
  title: string;
  component: z.infer<typeof ComponentRef>;
  config: Record<string, unknown>;
};

export const SETUP_PAGES: readonly SetupPage[] = [
  { title: "Vue d'ensemble", component: "overview@1.0.0", config: {} },
  { title: "Planning", component: "planning@1.0.0", config: {} },
  { title: "Kanban", component: "kanban@1.0.0", config: { filter: "all" } },
  { title: "Graphe", component: "graph@1.0.0", config: { filter: "all" } },
  { title: "Questions", component: "questions@1.0.0", config: {} },
];
