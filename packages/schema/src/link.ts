import { z } from "zod";
import { NodeId } from "./ids";

export const Link = z.object({
  id: z.string(),
  from: NodeId,
  to: NodeId,
  type: z.enum(["blocks", "relates"]),
});
export type Link = z.infer<typeof Link>;
