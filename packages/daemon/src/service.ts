import {
  countTicketsByStatus,
  createProjectDoc,
  createWorkspaceDoc,
  executeProjectCommand,
  listProjects,
  readProject,
  registerProject,
} from "@kibo/core";
import {
  type ChangeMessage,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
  type RpcRequest,
  type Session,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { applyRules, createDataPort } from "./agents/data-port";
import type { AgentDataPort, Orchestrator } from "./agents/orchestrator";
import type { Docs } from "./docs";
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

export type Service = {
  handle(req: RpcRequest): unknown;
  onChange(listener: (message: ChangeMessage) => void): () => void;
  agentData: AgentDataPort;
  attachAgents(agents: AgentsPort): () => void;
};

type ServiceOptions = { user: string; notifications?: Session["notifications"] };

const WORKSPACE = "workspace";
const projectDocId = (id: string) => `project:${id}`;
const changesDomainUsage = (cmd: ProjectCommand) =>
  (cmd.method === "updateTicket" && cmd.domainId !== undefined) || cmd.method === "deleteTicket";

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
  };
  const agentsReady = (): AgentsPort => {
    if (!agents) throw new KiboError("INTERNAL", "agents are not ready");
    return agents;
  };

  const runProjectCommand = (projectId: string, command: ProjectCommand): unknown => {
    const doc = docs.project(projectId);
    const result = executeProjectCommand(doc, command);
    if (command.method === "setStatus") {
      applyRules(doc, { kind: "status_changed", ticketId: command.ticketId });
    }
    docs.save(projectId);
    docs.emit({ projectId });
    if (changesDomainUsage(command)) docs.emit({ topic: "config" });
    return result;
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
    handle(req) {
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
        case "command":
          return runProjectCommand(req.projectId, req.command);
        case "getConfig":
          return readConfig(docs);
        case "config":
          return runConfigCommand(docs, req.command, (profileId) => agents?.activeRuns(profileId) ?? 0);
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
