import { existsSync, realpathSync } from "node:fs";
import { DUPLICATION_LIMITS, isTerminal, type RunView } from "@kibo/schema";
import type { DetectorSpace } from "./detector";
import { startOf } from "./work-view";
import type { WorkspaceRef } from "./workspace";

export type SpacePorts = {
  runs(): RunView[];
  workspaceOf(run: RunView): Promise<WorkspaceRef | null>;
  now(): number;
};

export type Spaces = {
  workspaces(projectId: string): Promise<DetectorSpace[]>;
  gone(workspace: string): boolean;
  projects(): string[];
};

export const isLive = (run: RunView, now: number): boolean =>
  !isTerminal(run.state) || (run.endedAt !== null && now - run.endedAt < DUPLICATION_LIMITS.peekRecentMs);

const realFolder = (path: string): string | null => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

export function createSpaces(ports: SpacePorts): Spaces {
  const liveTicketRuns = (): RunView[] =>
    ports.runs().filter((r) => r.kind === "ticket" && r.projectId !== null && isLive(r, ports.now()));

  async function workspaces(projectId: string): Promise<DetectorSpace[]> {
    const runs = liveTicketRuns().filter((r) => r.projectId === projectId);
    const placed = await Promise.all(runs.map(async (run) => ({ run, ws: await ports.workspaceOf(run) })));
    const spaces = new Map<string, DetectorSpace>();
    for (const { run, ws } of placed) {
      if (ws === null) continue;
      const space = spaces.get(ws.key) ?? { ws, runs: [], allRunIds: [] };
      space.runs.push({ key: ws.key, runId: run.id, startedAt: startOf(run) });
      space.allRunIds.push(run.id);
      spaces.set(ws.key, space);
    }
    return [...spaces.values()];
  }

  return {
    workspaces,
    gone(workspace) {
      if (!existsSync(workspace)) return true;
      return !liveTicketRuns().some((r) => r.cwd !== null && realFolder(r.cwd) === workspace);
    },
    projects: () => [...new Set(liveTicketRuns().flatMap((r) => r.projectId ?? []))],
  };
}
