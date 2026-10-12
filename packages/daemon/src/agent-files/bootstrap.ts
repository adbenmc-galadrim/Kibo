import type { Database } from "bun:sqlite";
import { listProjects } from "@kibo/core";
import type { AgentRef } from "@kibo/schema";
import type { RunStore } from "../agents/run-store";
import type { Docs } from "../docs";
import { type AgentCatalog, createAgentCatalog } from "./catalog";
import { type ClaudeEnv, claudeHomeOf } from "./claude-home";
import type { ProjectFolderRef } from "./discover";
import { createFileHistory, type FileHistory } from "./file-history";
import { migrateProfiles } from "./migration";
import { createNoticeBox } from "./notices";
import type { AgentRoots } from "./paths";
import { type AgentFilesService, createAgentFilesService } from "./service";
import { type AgentSettingsStore, createAgentSettingsStore } from "./settings-store";
import { AGENT_TEMPLATE_FILES } from "./templates";
import type { WatchPathsFn } from "./watch";

export type AgentFilesInput = {
  home: string;
  env: ClaudeEnv;
  userHome: string;
  db: Database;
  runs: Pick<RunStore, "rewriteAgentRefs" | "marker" | "setMarker" | "records">;
  docs: Pick<Docs, "workspace" | "save" | "emit">;
  activeRuns(ref: AgentRef): number;
  watch?: WatchPathsFn;
  now?: () => number;
};

export type AgentFiles = {
  service: AgentFilesService;
  catalog: AgentCatalog;
  roots: AgentRoots;
  history: FileHistory;
  settings: AgentSettingsStore;
  projects(): ProjectFolderRef[];
  stop(): void;
};

export async function startAgentFiles(input: AgentFilesInput): Promise<AgentFiles> {
  const { docs } = input;
  const metas = () => listProjects(docs.workspace);
  const projects = (): ProjectFolderRef[] => metas().map((m) => ({ id: m.id, folder: m.folder }));
  const roots: AgentRoots = {
    claudeHome: claudeHomeOf(input.env, input.userHome),
    projectFolder: (id) => metas().find((m) => m.id === id)?.folder ?? null,
  };
  const settings = createAgentSettingsStore(input.db);
  const history = createFileHistory({ home: input.home, db: input.db });
  const migration = await migrateProfiles({
    workspace: docs.workspace,
    saveWorkspace: () => docs.save(null),
    runs: input.runs,
    roots,
    settings,
    history,
    projectKeys: Object.fromEntries(metas().map((m) => [m.id, m.key])),
    now: input.now ?? Date.now,
  });
  const catalog = createAgentCatalog({
    roots,
    projects,
    settings,
    history,
    activeRuns: input.activeRuns,
    ...(input.watch && { watch: input.watch }),
  });
  const emit = () => docs.emit({ topic: "agent-files" });
  const service = createAgentFilesService({
    catalog,
    roots,
    settings,
    history,
    templates: AGENT_TEMPLATE_FILES,
    notices: createNoticeBox(migration.notices),
    emit,
  });
  await service.ensureSystemAgents().catch(async (e: unknown) => {
    console.error("[kibo-daemon] Kibo agents could not be written, discovery goes on", e);
    await catalog.refresh();
  });
  const unsubscribe = catalog.onChange(emit);
  return {
    service,
    catalog,
    roots,
    history,
    settings,
    projects,
    stop() {
      unsubscribe();
      catalog.close();
      history.close();
    },
  };
}
