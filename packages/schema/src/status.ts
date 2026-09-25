import { z } from "zod";

export const StatusId = z.enum(["backlog", "todo", "in_progress", "in_review", "blocked", "done"]);
export type StatusId = z.infer<typeof StatusId>;

export const Status = z.object({ id: StatusId, label: z.string(), order: z.number().int() });
export type Status = z.infer<typeof Status>;

export const DEFAULT_WORKFLOW: Status[] = [
  { id: "backlog", label: "Backlog", order: 0 },
  { id: "todo", label: "À faire", order: 1 },
  { id: "in_progress", label: "En cours", order: 2 },
  { id: "in_review", label: "En review", order: 3 },
  { id: "blocked", label: "Bloqué", order: 4 },
  { id: "done", label: "Terminé", order: 5 },
];
