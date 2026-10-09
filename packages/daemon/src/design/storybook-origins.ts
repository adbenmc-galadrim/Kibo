import { basename } from "node:path";
import {
  KiboError,
  type StorybookOrigin,
  type StorybookSettings,
  type Worktree,
  worktreeOrigin,
} from "@kibo/schema";
import type { StorybookClient } from "./providers/storybook";

export type StorybookOriginsDeps = {
  settings(projectId: string): StorybookSettings;
  folder(projectId: string): string | null;
  worktrees(folder: string): Promise<Worktree[]>;
  envPort(dir: string, name: string): number | null;
  client: Pick<StorybookClient, "probe">;
  log(message: string): void;
};
export type StorybookOrigins = {
  list(projectId: string): Promise<StorybookOrigin[]>;
  assertAllowed(projectId: string, origin: string): Promise<void>;
};
type Candidate = Omit<StorybookOrigin, "reachable">;

const PROJECT_LABEL = "Projet";
const normalized = (origin: string) => new URL(origin).origin;

export function createStorybookOrigins(deps: StorybookOriginsDeps): StorybookOrigins {
  const portOf = (wt: Worktree, name: string): number | null => {
    try {
      return deps.envPort(wt.path, name);
    } catch (e) {
      deps.log(`storybook port of worktree ${wt.path} unreadable: ${String(e)}`);
      return null;
    }
  };
  const listWorktrees = async (folder: string): Promise<Worktree[]> => {
    try {
      return await deps.worktrees(folder);
    } catch (e) {
      deps.log(`storybook worktrees of ${folder} unreadable: ${e instanceof KiboError ? e.code : String(e)}`);
      return [];
    }
  };
  const worktreeCandidates = async (projectId: string, settings: StorybookSettings): Promise<Candidate[]> => {
    const folder = deps.folder(projectId);
    if (folder === null) return [];
    const found: Candidate[] = [];
    for (const wt of await listWorktrees(folder)) {
      if (wt.isMain) continue;
      const port = portOf(wt, settings.portEnv);
      if (port === null) continue;
      const origin = worktreeOrigin(settings.origin, port);
      found.push({ label: wt.branch ?? basename(wt.path), origin, branch: wt.branch, path: wt.path });
    }
    return found;
  };
  const candidates = async (projectId: string): Promise<Candidate[]> => {
    const settings = deps.settings(projectId);
    const project = { label: PROJECT_LABEL, origin: normalized(settings.origin), branch: null, path: null };
    const seen = new Set<string>();
    return [project, ...(await worktreeCandidates(projectId, settings))].filter((c) => {
      if (seen.has(c.origin)) return false;
      seen.add(c.origin);
      return true;
    });
  };
  return {
    async list(projectId) {
      const all = await candidates(projectId);
      const reachable = await Promise.all(all.map((c) => deps.client.probe(c.origin)));
      return all.map((c, i) => ({ ...c, reachable: reachable[i] === true }));
    },
    async assertAllowed(projectId, origin) {
      const wanted = normalized(origin);
      if ((await candidates(projectId)).some((c) => c.origin === wanted)) return;
      throw new KiboError("INVALID_INPUT", `storybook origin ${wanted} is not declared in the project`);
    },
  };
}
