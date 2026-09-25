import { z } from "zod";
import { NodeId } from "./ids";

export const ComponentRef = z.string().regex(/^[a-z][a-z0-9.-]*@\d+\.\d+\.\d+$/);
export const Layout = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type Layout = z.infer<typeof Layout>;
export const Instance = z.object({
  id: z.string(),
  pageId: NodeId,
  component: ComponentRef,
  layout: Layout,
  config: z.record(z.string(), z.unknown()),
});
export type Instance = z.infer<typeof Instance>;
