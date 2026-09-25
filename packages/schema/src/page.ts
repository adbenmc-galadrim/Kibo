import { z } from "zod";
import { NodeId } from "./ids";

export const PageKind = z.enum(["dashboard", "view"]);
export const Page = z.object({
  id: NodeId,
  title: z.string().trim().min(1),
  kind: PageKind,
  parentId: NodeId.nullable(),
});
export type Page = z.infer<typeof Page>;
