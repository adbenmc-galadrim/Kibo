import {
  assertShellCommand,
  countTicketsByStatus,
  createProjectDoc,
  createWorkspaceDoc,
  getKeyAllocator,
  getProjectMeta,
  listInstances,
  listProjectDomains,
  listProjects,
  readProject,
  registerProject,
} from "@kibo/core";
import type { RuleTrigger } from "@kibo/core/rules";
import {
  type ChangeMessage,
  iconOwnerKey,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
  type ProjectSyncInfo,
  type RpcRequest,
  type RpcResult,
  type Session,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createDataPort } from "./agents/data-port";
import type { AgentDataPort } from "./agents/orchestrator";
import { type AgentsPort, handleAgentRequest } from "./agents-rpc";
import { type AiPort, isAiRequest } from "./ai/methods";
import { type CommandHub, createCommandPath } from "./command-path";
import { type ComponentRequest, isComponentRequest, type ShellRequest } from "./components/methods";
import type { Docs } from "./docs";
import { createIconStore, ensureIconsTable, type IconStore } from "./icons/icon-store";
import { isIntegrationRequest } from "./integrations/methods";
import type { IntegrationRpc } from "./integrations/registry";
import { createProjectSettings, ensureSettingsTable } from "./notes/settings";
import { withLocalFolder } from "./project-folder";
import { projectDocId, WORKSPACE_DOC_ID } from "./projects/doc-ids";
import { writeProjectMeta } from "./projects/meta";
import { createProjectRemoval } from "./projects/remove";
import { loadDoc, type Store } from "./store";
import { readTabs, saveTabs } from "./tabs-store";
import { readConfig, runConfigCommand } from "./workspace-config";

export type ComponentsPort = {
  handle(req: ComponentRequest): Promise<unknown>;
  afterCommand(projectId: string): void;
};

export type { AgentsPort } from "./agents-rpc";

export type Service = {
  handle(req: RpcRequest): unknown;
  onChange(listener: (message: ChangeMessage) => void): () => void;
  docs: Docs;
  icons: IconStore;
  agentData: AgentDataPort;
  attachAgents(agents: AgentsPort): () => void;
  attachComponents(components: ComponentsPort): () => void;
  attachIntegrations(rpc: IntegrationRpc): () => void;
  attachAi(port: AiPort): () => void;
  attachCollab(port: CollabPort): () => void;
  triggerRules(projectId: string, trigger: RuleTrigger): void;
  transaction<T>(fn: () => T): T;
  commands: CommandHub;
};

export type CollabPort = { syncInfo(projectId: string, doc: LoroDoc): ProjectSyncInfo };

type ServiceOptions = { user: string; notifications?: Session["notifications"] };

const projectIcon = (projectId: string) => iconOwnerKey({ kind: "project", projectId });
const changesDomainUsage = (cmd: ProjectCommand) =>
  (cmd.method === "updateTicket" && cmd.domainId !== undefined) || cmd.method === "deleteTicket";

export function call<R extends ShellRequest>(service: Service, req: R): RpcResult[R["method"]] {
  return service.handle(req) as RpcResult[R["method"]];
}

export function createService(store: Store, opts: ServiceOptions): Service {
  const workspace = loadDoc(store, WORKSPACE_DOC_ID) ?? createWorkspaceDoc();
  const projects = new Map<string, LoroDoc>();
  for (const meta of listProjects(workspace)) {
    const doc = loadDoc(store, projectDocId(meta.id));
    if (!doc) throw new KiboError("STORE_CORRUPT", `project ${meta.key} is registered but has no data`);
    projects.set(meta.id, doc);
  }
  const listeners = new Set<(message: ChangeMessage) => void>();
  let agents: AgentsPort | null = null;
  let components: ComponentsPort | null = null;
  let integrations: IntegrationRpc | null = null;
  let ai: AiPort | null = null;
  let collab: CollabPort | null = null;
  let writeGuard: ((projectId: string) => void) | null = null;
  const osIdentity = () => opts.user;
  let identity: (projectId: string) => string = osIdentity;
  ensureSettingsTable(store.db);
  const settings = createProjectSettings(store.db);
  ensureIconsTable(store.db);
  const icons = createIconStore(store.db);
  const docListeners = new Set<(projectId: string, doc: LoroDoc) => void>();
  const adopt = (id: string, doc: LoroDoc) => {
    projects.set(id, doc);
    for (const listener of docListeners) listener(id, doc);
  };
  const removal = createProjectRemoval({
    store,
    workspace,
    drop: (id) => projects.delete(id),
    emit: (message) => docs.emit(message),
  });
  const path = createCommandPath({
    store,
    project: (id) => docs.project(id),
    assertWritable: (id) => docs.assertWritable(id),
    save: (id) => docs.save(id),
    restore(id) {
      const restored = loadDoc(store, projectDocId(id));
      if (!restored) throw new KiboError("STORE_CORRUPT", `project ${id} lost its snapshot`);
      adopt(id, restored);
    },
    emit: (message) => docs.emit(message),
    published(projectId, done) {
      docs.emit({ projectId });
      if (done.some((e) => changesDomainUsage(e.command))) docs.emit({ topic: "config" });
      components?.afterCommand(projectId);
    },
  });
  const docs: Docs = {
    workspace,
    project(id) {
      const doc = projects.get(id);
      if (!doc) throw new KiboError("NOT_FOUND", `project ${id} not found`);
      return doc;
    },
    projectIds: () => [...projects.keys()],
    save(projectId) {
      const doc = projectId === null ? workspace : docs.project(projectId);
      store.save(
        projectId === null ? WORKSPACE_DOC_ID : projectDocId(projectId),
        doc.export({ mode: "snapshot" }),
      );
    },
    emit(message) {
      for (const listener of listeners) listener(message);
    },
    run: (projectId, command, meta) => path.run(projectId, command, meta),
    trigger: (projectId, trigger) => path.trigger(projectId, trigger),
    replaceProject(projectId, doc) {
      docs.project(projectId);
      adopt(projectId, doc);
      docs.imported(projectId);
    },
    addProject(meta, doc) {
      registerProject(workspace, meta);
      adopt(meta.id, doc);
      docs.save(meta.id);
      docs.save(null);
      docs.emit({ projectId: null });
    },
    removeProject: (projectId) => removal.remove(projectId),
    onProjectRemoved: (listener) => removal.onRemoved(listener),
    imported(projectId) {
      docs.save(projectId);
      docs.emit({ projectId });
      components?.afterCommand(projectId);
    },
    onProjectDoc(listener) {
      docListeners.add(listener);
      return () => docListeners.delete(listener);
    },
    assertWritable: (projectId) => writeGuard?.(projectId),
    setWriteGuard(guard) {
      writeGuard = guard;
      return () => {
        if (writeGuard === guard) writeGuard = null;
      };
    },
    projectMeta: (projectId) => {
      const doc = docs.project(projectId);
      return withLocalFolder(getProjectMeta(doc), settings, getKeyAllocator(doc) === "server");
    },
    updateProjectMeta: (projectId, patch, folderInDoc) =>
      writeProjectMeta(docs, projectId, patch, folderInDoc),
    identity: (projectId) => identity(projectId),
    setIdentity(fn) {
      identity = fn;
      return () => {
        if (identity === fn) identity = osIdentity;
      };
    },
  };
  const componentsReady = (): ComponentsPort => {
    if (!components) throw new KiboError("INTERNAL", "components are not ready");
    return components;
  };
  const integrationsReady = (): IntegrationRpc => {
    if (!integrations) throw new KiboError("INTERNAL", "integrations are not ready");
    return integrations;
  };
  const aiReady = (): AiPort => {
    if (!ai) throw new KiboError("AI_UNAVAILABLE", "the AI is not started");
    return ai;
  };
  const agentsReady = (): AgentsPort => {
    if (!agents) throw new KiboError("INTERNAL", "agents are not ready");
    return agents;
  };

  return {
    docs,
    icons,
    agentData: createDataPort(docs),
    attachAgents(port) {
      agents = port;
      const offTopic = port.onChange(() => docs.emit({ topic: "agents" }));
      const offRuns = port.onRunState((run) =>
        docs.emit({ type: "run.changed", runId: run.id, state: run.state }),
      );
      return () => {
        offTopic();
        offRuns();
        agents = null;
      };
    },
    attachComponents(port) {
      components = port;
      return () => {
        components = null;
      };
    },
    attachIntegrations(rpc) {
      integrations = rpc;
      return () => {
        integrations = null;
      };
    },
    attachAi(port) {
      ai = port;
      return () => {
        ai = null;
      };
    },
    attachCollab(port) {
      collab = port;
      return () => {
        collab = null;
      };
    },
    triggerRules(projectId, trigger) {
      docs.trigger(projectId, trigger);
    },
    transaction: (fn) => path.transaction(fn),
    commands: path.commands,
    handle(req) {
      if (isComponentRequest(req)) return componentsReady().handle(req);
      if (isIntegrationRequest(req)) return integrationsReady().handle(req);
      if (isAiRequest(req)) return aiReady().handle(req);
      switch (req.method) {
        case "getSession":
          return { user: opts.user, notifications: opts.notifications ?? "browser" };
        case "listProjects":
          return listProjects(workspace).map((meta) => ({
            ...meta,
            counts: countTicketsByStatus(docs.project(meta.id)),
            icon: icons.version(projectIcon(meta.id)),
          }));
        case "createProject": {
          const meta: ProjectMeta = {
            id: crypto.randomUUID(),
            key: req.key,
            name: req.name,
            folder: req.folder,
            color: req.color,
          };
          registerProject(workspace, meta);
          adopt(meta.id, createProjectDoc(meta));
          docs.save(meta.id);
          docs.save(null);
          docs.emit({ projectId: null });
          return meta;
        }
        case "getProject": {
          const doc = docs.project(req.projectId);
          const snapshot = {
            ...readProject(doc),
            meta: docs.projectMeta(req.projectId),
            viewer: docs.identity(req.projectId),
            icon: icons.version(projectIcon(req.projectId)),
            ...(getKeyAllocator(doc) === "server" && { domains: listProjectDomains(doc) }),
          };
          return collab ? { ...snapshot, sync: collab.syncInfo(req.projectId, doc) } : snapshot;
        }
        case "command": {
          assertShellCommand(req.command);
          const instanceId = req.instanceId ?? null;
          if (
            instanceId !== null &&
            !listInstances(docs.project(req.projectId)).some((i) => i.id === instanceId)
          )
            throw new KiboError("NOT_FOUND", `instance ${instanceId} not found`);
          return docs.run(req.projectId, req.command, { origin: "user", instanceId });
        }
        case "getConfig":
          return readConfig(docs, icons);
        case "config":
          return runConfigCommand(docs, req.command, (profileId) => agents?.activeRuns(profileId) ?? 0);
        case "getTabs":
          return readTabs(store);
        case "saveTabs":
          return saveTabs(store, req.state);
        default:
          return handleAgentRequest(agentsReady(), req);
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
