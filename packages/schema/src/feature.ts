import { z } from "zod";

export const ShortKey = z.string().regex(/^[A-Z]{1,3}[0-9]{1,3}$/);
export type ShortKey = z.infer<typeof ShortKey>;

export const isFeature = (t: { parentId: string | null; progress: { total: number } }): boolean =>
  t.parentId === null && t.progress.total > 0;

type SprintFacts = { parentId: string | null; sprintId: string | null };

export function effectiveSprintId(ticketId: string, byId: ReadonlyMap<string, SprintFacts>): string | null {
  const seen = new Set<string>();
  let current = byId.get(ticketId);
  while (current !== undefined && current.parentId !== null && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = byId.get(current.parentId);
  }
  return current?.parentId === null ? current.sprintId : null;
}
