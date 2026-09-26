import { z } from "zod";
import { StatusId } from "./status";

export const Rule = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  when: z.enum(["run_started", "run_done", "children_done"]),
  from: z.array(StatusId),
  to: StatusId.exclude(["blocked"]),
});
export type Rule = z.infer<typeof Rule>;

export const DEFAULT_RULES: Rule[] = [
  {
    id: "run-started-in-progress",
    enabled: true,
    when: "run_started",
    from: ["backlog", "todo"],
    to: "in_progress",
  },
  {
    id: "run-done-review",
    enabled: true,
    when: "run_done",
    from: ["backlog", "todo", "in_progress"],
    to: "in_review",
  },
  {
    id: "children-done-parent",
    enabled: true,
    when: "children_done",
    from: ["backlog", "todo", "in_progress", "in_review"],
    to: "done",
  },
];
