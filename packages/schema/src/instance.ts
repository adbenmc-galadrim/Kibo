import { z } from "zod";
import { KiboError } from "./errors";
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

export const DataKey = z.string().regex(/^[A-Za-z0-9._-]{1,128}$/);
export const INSTANCE_DATA_LIMIT = 262_144;

export function splitRef(ref: string): { id: string; version: string } {
  const at = ref.lastIndexOf("@");
  if (at <= 0) throw new KiboError("INVALID_INPUT", `invalid component ref ${ref}`);
  return { id: ref.slice(0, at), version: ref.slice(at + 1) };
}

export const formatRef = (id: string, version: string): string => `${id}@${version}`;
