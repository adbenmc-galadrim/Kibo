import { z } from "zod";
import { RelPath } from "./code";
import { NodeId } from "./ids";

const ProjectId = z.string().min(1);
const WorktreePath = z.string().min(1).nullable();

export const TabTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), projectId: ProjectId }),
  z.object({ kind: z.literal("page"), projectId: ProjectId, pageId: NodeId }),
  z.object({ kind: z.literal("changes"), projectId: ProjectId, worktree: WorktreePath }),
  z.object({
    kind: z.literal("file"),
    projectId: ProjectId,
    worktree: WorktreePath,
    path: RelPath,
    line: z.number().int().positive().nullable(),
  }),
  z.object({ kind: z.literal("ticket"), projectId: ProjectId, ticketId: NodeId }),
]);
export type TabTarget = z.infer<typeof TabTarget>;

export const Tab = z.object({ id: z.string().min(1), target: TabTarget, pinned: z.boolean() });
export type Tab = z.infer<typeof Tab>;

export const MAX_TABS = 50;
export const MAX_RECENTS = 10;

export const TabsState = z.object({
  tabs: z.array(Tab).max(MAX_TABS),
  activeId: z.string().nullable(),
  recents: z.array(TabTarget).max(MAX_RECENTS),
});
export type TabsState = z.infer<typeof TabsState>;

export const EMPTY_TABS: TabsState = { tabs: [], activeId: null, recents: [] };
