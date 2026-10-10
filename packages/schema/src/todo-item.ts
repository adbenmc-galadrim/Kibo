import { z } from "zod";

export const TodoItem = z.object({
  content: z.string().max(160),
  status: z.enum(["pending", "in_progress", "completed"]),
  activeForm: z.string().max(160).optional(),
});
export type TodoItem = z.infer<typeof TodoItem>;
