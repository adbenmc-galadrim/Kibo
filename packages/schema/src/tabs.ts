import { z } from "zod";
import { RelPath } from "./code";
import { NodeId } from "./ids";

const ProjectId = z.string().min(1);
const WorktreePath = z.string().min(1).nullable();

export const Screen = z.enum(["agents", "queue", "domains", "components"]);
export type Screen = z.infer<typeof Screen>;

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
  z.object({ kind: z.literal("screen"), screen: Screen }),
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

const StoredTabs = z.object({
  tabs: z.array(z.unknown()),
  activeId: z.string().nullable(),
  recents: z.array(z.unknown()),
});

const keepValid = <T>(schema: z.ZodType<T>, items: unknown[]): T[] =>
  items.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });

export function salvageTabsState(raw: unknown): TabsState | null {
  const stored = StoredTabs.safeParse(raw);
  if (!stored.success) return null;
  const tabs = keepValid(Tab, stored.data.tabs);
  const activeId = tabs.some((t) => t.id === stored.data.activeId) ? stored.data.activeId : null;
  const parsed = TabsState.safeParse({ tabs, activeId, recents: keepValid(TabTarget, stored.data.recents) });
  return parsed.success ? parsed.data : null;
}
