import type { ChangeKind } from "@kibo/schema";

export const ADDED = "text-green-800 dark:text-green-400";
export const REMOVED = "text-red-700 dark:text-red-400";
export const MUTED = "text-zinc-600 dark:text-zinc-400";
export const KIND_TONE: Record<ChangeKind, string> = {
  modified: "text-amber-700 dark:text-amber-400",
  added: ADDED,
  untracked: ADDED,
  deleted: REMOVED,
  renamed: "text-sky-700 dark:text-sky-400",
  conflicted: REMOVED,
};

export const splitPath = (path: string) => {
  const slash = path.lastIndexOf("/");
  return { name: path.slice(slash + 1), dir: slash >= 0 ? path.slice(0, slash + 1) : "" };
};
