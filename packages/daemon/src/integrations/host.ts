import { listProjects, readProject } from "@kibo/core";
import { type CommandResult, KiboError, type ProjectCommand, type Worktree } from "@kibo/schema";
import type { Notice } from "../agents/notifier";
import { openRepo } from "../code/repo";
import { createGit, runGh } from "../code/run";
import type { CommandMeta } from "../docs";
import { createProjectSettings } from "../notes/settings";
import type { Service } from "../service";
import type { Store } from "../store";
import type { IntegrationHost } from "./types";

export type HostParts = {
  user: string;
  home: string;
  store: Store;
  service: Service;
  notify(notice: Notice): void;
  now?: () => number;
  sandboxOrigin(): string | null;
  uiPort(): number | null;
};

async function worktreesOf(folder: string): Promise<Worktree[]> {
  try {
    return await (await openRepo(folder)).worktrees();
  } catch (e) {
    if (e instanceof KiboError && e.code === "NOT_A_REPO") return [];
    throw e;
  }
}

const uiOriginsOf = (port: number | null): string[] =>
  port === null ? [] : [`http://127.0.0.1:${port}`, `http://localhost:${port}`];

export function createIntegrationHost(parts: HostParts): IntegrationHost {
  const { docs, commands } = parts.service;
  return {
    user: parts.user,
    identity: (projectId) => docs.identity(projectId),
    home: parts.home,
    db: parts.store.db,
    transaction: (fn) => parts.service.transaction(fn),
    projects: () => listProjects(docs.workspace),
    snapshot: (projectId) => readProject(docs.project(projectId)),
    command<C extends ProjectCommand>(
      projectId: string,
      cmd: C,
      meta: CommandMeta,
    ): CommandResult[C["method"]] {
      return docs.run(projectId, cmd, meta) as CommandResult[C["method"]];
    },
    onCommand: commands.onCommand,
    intercept: commands.intercept,
    broadcast: (event) => docs.emit(event),
    notify(notice) {
      parts.notify(notice);
      docs.emit({ type: "notice", title: notice.title, body: notice.body });
    },
    async gitRemoteUrl(projectId) {
      const folder = docs.projectMeta(projectId).folder;
      if (!folder) return null;
      const r = await createGit(folder).run(["remote", "get-url", "origin"]);
      return r.code === 0 && r.stdout.trim() ? r.stdout.trim() : null;
    },
    async gitAvailable() {
      try {
        return (await createGit(parts.home).run(["--version"])).code === 0;
      } catch (e) {
        if (e instanceof KiboError && e.code === "GIT_FAILED") return false;
        throw e;
      }
    },
    gh: (args) => runGh(args, { cwd: parts.home, env: {} }),
    now: parts.now ?? Date.now,
    sandboxOrigin: () => parts.sandboxOrigin(),
    projectSettings: createProjectSettings(parts.store.db),
    worktrees: worktreesOf,
    uiOrigins: () => uiOriginsOf(parts.uiPort()),
  };
}
