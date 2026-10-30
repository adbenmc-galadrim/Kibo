import { createWorkspaceDoc, getProjectMeta, listProjects, registerProject } from "@kibo/core";
import type { RuleTrigger } from "@kibo/core/rules";
import {
  type ChangeMessage,
  INBOX_ID,
  isInbox,
  KiboError,
  NO_ACTIVITY,
  type ProjectAgentSummary,
  type ProjectCommand,
  type RpcRequest,
  type RpcResult,
  type Session,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { type Clock, createClock } from "./clock";
import { type CommandHub, createCommandPath } from "./command-path";
import { type ComponentRequest, isComponentRequest, type ShellRequest } from "./components/methods";
import type { Docs } from "./docs";
import { createIconStore, ensureIconsTable, type IconStore } from "./icons/icon-store";
import { createFileTicket } from "./inbox/file-ticket";
import { loadInbox } from "./inbox/inbox-doc";
import { assertInboxCommand, assertNotInbox } from "./inbox/inbox-rules";
import { isIntegrationRequest } from "./integrations/methods";
import type { IntegrationRpc } from "./integrations/registry";
import { createProjectSettings, ensureSettingsTable } from "./notes/settings";
import { type ActivitySources, type ActivityTracker, createActivityTracker } from "./project-activity";
import { withLocalSettings } from "./project-folder";
import { projectDocId, WORKSPACE_DOC_ID } from "./projects/doc-ids";
import { writeProjectMeta } from "./projects/meta";
import { handleProjectRequest, NOT_HANDLED } from "./projects/project-rpc";
import { createProjectRemoval } from "./projects/remove";
import { questionActorInterceptor } from "./questions/question-actor";
import { type AnswerWake, afterQuestionCommands } from "./questions/question-events";
import { type QuestionImageDeps, questionImagesOf } from "./questions/question-images-port";
import { createDataPort } from "./runs/data-port";
import type { AgentSource } from "./runs/neutral-agents";
import type { AgentDataPort } from "./runs/orchestrator";
import { type AgentQuestions, type AgentsPort, handleAgentRequest } from "./runs/rpc";
import { portSlot, ready } from "./service-ports";
import { loadDoc, type Store } from "./store";
import { readTabs, saveTabs } from "./tabs-store";
import { holdSinceInterceptor } from "./tracking/hold-since";
import { readConfig, runConfigCommand } from "./workspace-config";

export type ComponentsPort = {
  handle(req: ComponentRequest): Promise<unknown>;
};

export type { AgentsPort } from "./runs/rpc";
export type AnswerWakePort = { wake: AnswerWake };

export type Service = {
  handle(req: RpcRequest): unknown;
  onChange(listener: (message: ChangeMessage) => void): () => void;
  docs: Docs;
  icons: IconStore;
  agentData: AgentDataPort;
  attachAgents(agents: AgentsPort): () => void;
  attachComponents(components: ComponentsPort): () => void;
  attachIntegrations(rpc: IntegrationRpc): () => void;
  attachProjectAgent(port: ProjectAgentSummaries): () => void;
  attachAnswerWake(port: AnswerWakePort): () => void;
  triggerRules(projectId: string, trigger: RuleTrigger): void;
  transaction<T>(fn: () => T): T;
  commands: CommandHub;
};

type ProjectAgentSummaries = { summaries(): ProjectAgentSummary[] };
type ServiceOptions = {
  user: string;
  notifications?: Session["notifications"];
  agents?: AgentSource;
  questionImages?: QuestionImageDeps;
  clock?: Clock;
  activity?: ActivitySources;
};

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
  projects.set(INBOX_ID, loadInbox(store));
  const listeners = new Set<(message: ChangeMessage) => void>();
  let agents: AgentsPort | null = null;
  const questionImages = questionImagesOf(opts.questionImages ?? null, () => null);
  let tracker: ActivityTracker | null = null;
  const components = portSlot<ComponentsPort>();
  const integrations = portSlot<IntegrationRpc>();
  const projectAgent = portSlot<ProjectAgentSummaries>();
  const answerWake = portSlot<AnswerWakePort>();
  let writeGuard: ((projectId: string) => void) | null = null;
  ensureSettingsTable(store.db);
  const settings = createProjectSettings(store.db);
  ensureIconsTable(store.db);
  const icons = createIconStore(store.db);
  const docListeners = new Set<(projectId: string, doc: LoroDoc) => void>();
  const adopt = (id: string, doc: LoroDoc) => {
    projects.set(id, doc);
    if (!isInbox(id)) for (const listener of docListeners) listener(id, doc);
  };
  const restore = (id: string) => {
    const restored = isInbox(id) ? loadInbox(store) : loadDoc(store, projectDocId(id));
    if (!restored) throw new KiboError("STORE_CORRUPT", `project ${id} lost its snapshot`);
    adopt(id, restored);
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
    restore,
    emit: (message) => docs.emit(message),
    published(projectId, done) {
      docs.emit({ projectId });
      if (done.some((e) => changesDomainUsage(e.command))) docs.emit({ topic: "config" });
      afterQuestionCommands(done, {
        emit: (m) => docs.emit(m),
        images: questionImages,
        wake: answerWake.get()?.wake ?? null,
      });
    },
  });
  const docs: Docs = {
    workspace,
    project(id) {
      const doc = projects.get(id);
      if (!doc) throw new KiboError("NOT_FOUND", `project ${id} not found`);
      return doc;
    },
    projectIds: () => [...projects.keys()].filter((id) => !isInbox(id)),
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
    run(projectId, command, meta) {
      if (isInbox(projectId)) assertInboxCommand(command);
      return path.run(projectId, command, meta);
    },
    trigger: (projectId, trigger) => path.trigger(projectId, trigger),
    replaceProject(projectId, doc) {
      assertNotInbox(projectId, "replacing a project");
      docs.project(projectId);
      adopt(projectId, doc);
      docs.imported(projectId);
    },
    addProject(meta, doc) {
      assertNotInbox(meta.id, "adding a project");
      registerProject(workspace, meta);
      adopt(meta.id, doc);
      docs.save(meta.id);
      docs.save(null);
      docs.emit({ projectId: null });
    },
    removeProject(projectId) {
      assertNotInbox(projectId, "removing a project");
      removal.remove(projectId);
    },
    onProjectRemoved: (listener) => removal.onRemoved(listener),
    imported(projectId) {
      docs.save(projectId);
      docs.emit({ projectId });
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
      return withLocalSettings(getProjectMeta(doc), settings);
    },
    updateProjectMeta: (projectId, patch) => writeProjectMeta(docs, settings, projectId, patch),
    identity: () => opts.user,
    activity: (projectId) => tracker?.activity(projectId) ?? NO_ACTIVITY,
    today: (opts.clock ?? createClock(null)).today,
  };
  const agentData = createDataPort(docs, settings, Date.now, opts.agents, opts.questionImages ?? null);
  const questions: AgentQuestions = { projectAgents: () => projectAgent.get()?.summaries() ?? [] };
  const viewer = (projectId: string) => docs.identity(projectId);
  path.commands.intercept(questionActorInterceptor(viewer));
  path.commands.intercept(holdSinceInterceptor(docs.today));
  const componentsReady = () => ready(components.get(), "INTERNAL", "components are not ready");
  const integrationsReady = () => ready(integrations.get(), "INTERNAL", "integrations are not ready");
  const agentsReady = () => ready(agents, "INTERNAL", "agents are not ready");
  const projectRpc = {
    workspace,
    docs,
    icons,
    settings,
    adopt,
    fileTicket: createFileTicket({ docs, store, restore }),
  };

  return {
    docs,
    icons,
    agentData,
    attachAgents(port) {
      agents = port;
      const activity = createActivityTracker(port.state().runs, opts.activity);
      tracker = activity;
      const offTopic = port.onChange(() => docs.emit({ topic: "agents" }));
      const offRuns = port.onRunState((run) => {
        activity.track(run);
        docs.emit({ type: "run.changed", runId: run.id, state: run.state });
        if (run.projectId !== null && projects.has(run.projectId)) docs.emit({ projectId: run.projectId });
      });
      return () => {
        offTopic();
        offRuns();
        agents = null;
        if (tracker === activity) tracker = null;
      };
    },
    attachComponents: components.attach,
    attachIntegrations: integrations.attach,
    attachProjectAgent: projectAgent.attach,
    attachAnswerWake: answerWake.attach,
    triggerRules(projectId, trigger) {
      docs.trigger(projectId, trigger);
    },
    transaction: (fn) => path.transaction(fn),
    commands: path.commands,
    handle(req) {
      if (isComponentRequest(req)) return componentsReady().handle(req);
      if (isIntegrationRequest(req)) return integrationsReady().handle(req);
      const handled = handleProjectRequest(projectRpc, req);
      if (handled !== NOT_HANDLED) return handled;
      switch (req.method) {
        case "getSession":
          return { user: opts.user, notifications: opts.notifications ?? "browser" };
        case "getConfig":
          return readConfig(docs, icons);
        case "config":
          return runConfigCommand(docs, req.command);
        case "getTabs":
          return readTabs(store);
        case "saveTabs":
          return saveTabs(store, req.state);
        default:
          return handleAgentRequest(agentsReady(), req, questions);
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
