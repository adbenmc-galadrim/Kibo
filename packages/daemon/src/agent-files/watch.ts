import { existsSync } from "node:fs";
import { join } from "node:path";
import { type WatchHandle, watchPaths } from "../code/watcher";
import type { ProjectFolderRef } from "./discover";
import type { AgentRoots } from "./paths";

export const WATCH_LIMIT = 500;
export const WATCH_DEBOUNCE_MS = 300;

export type WatchPathsFn = typeof watchPaths;
export type AgentWatch = { targets: string[]; partial: boolean; close(): void };

export function agentWatchTargets(roots: AgentRoots, projects: readonly ProjectFolderRef[]): string[] {
  const dirs = [
    join(roots.claudeHome, "agents"),
    ...projects.flatMap((p) => (p.folder === null ? [] : [join(p.folder, ".claude", "agents")])),
  ];
  return dirs.filter((d) => existsSync(d));
}

export function watchAgentRoots(
  roots: AgentRoots,
  projects: readonly ProjectFolderRef[],
  onChange: () => void,
  options: { watch?: WatchPathsFn; limit?: number } = {},
): AgentWatch {
  const limit = options.limit ?? WATCH_LIMIT;
  const all = agentWatchTargets(roots, projects);
  const targets = all.slice(0, limit);
  const watch = options.watch ?? watchPaths;
  const handle: WatchHandle | null =
    targets.length === 0
      ? null
      : watch(
          targets.map((path) => ({ path, recursive: false })),
          () => onChange(),
          { debounceMs: WATCH_DEBOUNCE_MS },
        );
  return { targets, partial: all.length > limit, close: () => handle?.close() };
}
