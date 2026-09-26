import {
  assertShellCommand,
  countTicketsByStatus,
  createProjectDoc,
  createWorkspaceDoc,
  listInstances,
  listProjects,
  readProject,
  registerProject,
} from "@kibo/core";
import type { RuleTrigger } from "@kibo/core/rules";
import {
  type ChangeMessage,
  EMPTY_TABS,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
  type RpcRequest,
  type RpcResult,
  type Session,
  salvageTabsState,
  TabsState,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { createDataPort } from "./agents/data-port";
import type { AgentDataPort, Orchestrator } from "./agents/orchestrator";
import { type CommandHub, createCommandPath } from "./command-path";
import { type ComponentRequest, isComponentRequest, type ShellRequest } from "./components/methods";
import type { Docs } from "./docs";
import { isIntegrationRequest } from "./integrations/methods";
import type { IntegrationRpc } from "./integrations/registry";
import { loadDoc, type Store } from "./store";
import { readConfig, runConfigCommand } from "./workspace-config";

export type AgentsPort = Pick<
  Orchestrator,
  | "assign"
  | "preview"
  | "answer"
  | "cancel"
  | "move"
  | "setPriority"
  | "setHost"
  | "state"
  | "log"
  | "activeRuns"
  | "onChange"
  | "onRunState"
>;

export type ComponentsPort = {
  handle(req: ComponentRequest): Promise<unknown>;
  afterCommand(projectId: string): void;
};

export type Service = {
  handle(req: RpcRequest): unknown;
  onChange(listener: (message: ChangeMessage) => void): () => void;
  docs: Docs;
  agentData: AgentDataPort;
  attachAgents(agents: AgentsPort): () => void;
  attachComponents(components: ComponentsPort): () => void;
  attachIntegrations(rpc: IntegrationRpc): () => void;
  triggerRules(projectId: string, trigger: RuleTrigger): void;
  transaction<T>(fn: () => T): T;
  commands: CommandHub;
};

type ServiceOptions = { user: string; notifications?: Session["notifications"] };

const WORKSPACE = "workspace";
const TABS_KEY = "tabs:workspace";
const projectDocId = (id: string) => `project:${id}`;
const changesDomainUsage = (cmd: ProjectCommand) =>
  (cmd.method === "updateTicket" && cmd.domainId !== undefined) || cmd.method === "deleteTicket";

export function call<R extends ShellRequest>(service: Service, req: R): RpcResult[R["method"]] {
  return service.handle(req) as RpcResult[R["method"]];
}

function readTabs(store: Store): TabsState {
  const raw = store.getLocal(TABS_KEY);
  if (raw === null) return EMPTY_TABS;
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = TabsState.safeParse(json);
    if (parsed.success) return parsed.data;
    const salvaged = salvageTabsState(json);
    if (salvaged) {
      console.error("[kibo-daemon] stored tabs had invalid entries, dropped", parsed.error.message);
      return salvaged;
    }
    console.error("[kibo-daemon] stored tabs are invalid, starting empty", parsed.error.message);
  } catch (e) {
    console.error("[kibo-daemon] stored tabs are unreadable, starting empty", e);
  }
  return EMPTY_TABS;
}

function saveTabs(store: Store, state: unknown): null {
  const parsed = TabsState.safeParse(state);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", parsed.error.message);
  store.setLocal(TABS_KEY, JSON.stringify(parsed.data));
  return null;
}

export function createService(store: Store, opts: ServiceOptions): Service {
  const workspace = loadDoc(store, WORKSPACE) ?? createWorkspaceDoc();
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
  const path = createCommandPath({
    store,
    project: (id) => docs.project(id),
    save: (id) => docs.save(id),
    restore(id) {
      const restored = loadDoc(store, projectDocId(id));
      if (!restored) throw new KiboError("STORE_CORRUPT", `project ${id} lost its snapshot`);
      projects.set(id, restored);
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
      store.save(projectId === null ? WORKSPACE : projectDocId(projectId), doc.export({ mode: "snapshot" }));
    },
    emit(message) {
      for (const listener of listeners) listener(message);
    },
    run: (projectId, command, meta) => path.run(projectId, command, meta),
    trigger: (projectId, trigger, meta) => path.trigger(projectId, trigger, meta),
  };
  const componentsReady = (): ComponentsPort => {
    if (!components) throw new KiboError("INTERNAL", "components are not ready");
    return components;
  };
  const integrationsReady = (): IntegrationRpc => {
    if (!integrations) throw new KiboError("INTERNAL", "integrations are not ready");
    return integrations;
  };
  const agentsReady = (): AgentsPort => {
    if (!agents) throw new KiboError("INTERNAL", "agents are not ready");
    return agents;
  };

  const handleAgents = (req: RpcRequest): unknown => {
    const port = agentsReady();
    switch (req.method) {
      case "getAgents":
        return port.state();
      case "getRunLog":
        return port.log(req.runId);
      case "previewAssign":
        return port.preview({ projectId: req.projectId, ticketId: req.ticketId, profileId: req.profileId });
      case "assignAgent":
        return port.assign({
          projectId: req.projectId,
          ticketId: req.ticketId,
          profileId: req.profileId,
          brief: req.brief,
        });
      case "answerRun":
        return port.answer(req.runId, req.text);
      case "cancelRun":
        return port.cancel(req.runId);
      case "moveRun":
        port.move(req.runId, req.index);
        return null;
      case "setRunPriority":
        port.setPriority(req.runId, req.priority);
        return null;
      case "setHost":
        return port.setHost(req.patch);
      default:
        throw new KiboError("INTERNAL", `${req.method} is not an agents method`);
    }
  };

  return {
    docs,
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
    triggerRules(projectId, trigger) {
      docs.trigger(projectId, trigger);
    },
    transaction: (fn) => path.transaction(fn),
    commands: path.commands,
    handle(req) {
      if (isComponentRequest(req)) return componentsReady().handle(req);
      if (isIntegrationRequest(req)) return integrationsReady().handle(req);
      switch (req.method) {
        case "getSession":
          return { user: opts.user, notifications: opts.notifications ?? "browser" };
        case "listProjects":
          return listProjects(workspace).map((meta) => ({
            ...meta,
            counts: countTicketsByStatus(docs.project(meta.id)),
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
          projects.set(meta.id, createProjectDoc(meta));
          docs.save(meta.id);
          docs.save(null);
          docs.emit({ projectId: null });
          return meta;
        }
        case "getProject":
          return readProject(docs.project(req.projectId));
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
          return readConfig(docs);
        case "config":
          return runConfigCommand(docs, req.command, (profileId) => agents?.activeRuns(profileId) ?? 0);
        case "getTabs":
          return readTabs(store);
        case "saveTabs":
          return saveTabs(store, req.state);
        default:
          return handleAgents(req);
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
