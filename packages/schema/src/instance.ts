import { z } from "zod";
import { NodeId } from "./ids";

export const ComponentRef = z.string().regex(/^[a-z][a-z0-9.-]*@\d+\.\d+\.\d+$/);
export const Instance = z.object({
  id: z.string(),
  pageId: NodeId,
  component: ComponentRef,
  layout: z.object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  config: z.record(z.string(), z.unknown()),
});
export type Instance = z.infer<typeof Instance>;
