import type { ActionKind, FileRef } from "@kibo/schema";

export type FileContext = { projectId: string; worktree: string; origin: string };

const FILE_KINDS: ReadonlySet<ActionKind> = new Set(["read", "edit", "create"]);

export function fileRefOf(
  ctx: FileContext | null | undefined,
  kind: ActionKind,
  target: string | null,
): FileRef | null {
  if (!ctx || !target || !FILE_KINDS.has(kind) || /\s/.test(target)) return null;
  const path = target.startsWith(`${ctx.worktree}/`) ? target.slice(ctx.worktree.length + 1) : target;
  if (path.startsWith("/") || path.split("/").includes("..")) return null;
  return { projectId: ctx.projectId, worktree: ctx.worktree, path, line: null, origin: ctx.origin };
}
