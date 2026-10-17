import {
  createProjectDoc,
  executeProjectCommand,
  readProject,
  setProjectMeta,
} from "../../packages/core/src/index";
import {
  INBOX_ID,
  INBOX_KEY,
  KiboError,
  type ProjectCommand,
  type ProjectMeta,
  type ProjectSnapshot,
  RpcRequest,
} from "../../packages/schema/src/index";
import type { SeedRpc } from "../seed-emis-maquettes";
import { createMemoryAgent, type MemoryAgent } from "./memory-agent";

export type MemoryEvent = { kind: string; ticketId: string | null; detail: string | number | null };

export type MemoryDaemon = {
  rpc: SeedRpc;
  writes(): number;
  snapshot(key: string, today: string): ProjectSnapshot;
  workspaceName(): string | null;
  projects(): ProjectMeta[];
  events(): MemoryEvent[];
  agentView: MemoryAgent["view"];
};

function eventOf(cmd: ProjectCommand): MemoryEvent | null {
  switch (cmd.method) {
    case "setStatus":
      return { kind: "status_changed", ticketId: cmd.ticketId, detail: cmd.statusId };
    case "setTicketSprint":
      return { kind: "sprint_set", ticketId: cmd.ticketId, detail: cmd.sprintId };
    case "upsertExternalRef":
      if (cmd.ref.kind === "git_branch")
        return { kind: "branch_created", ticketId: cmd.ticketId, detail: cmd.ref.branch };
      if (cmd.ref.kind !== "github_pr") return null;
      return {
        kind: cmd.ref.state === "merged" ? "pr_merged" : "pr_opened",
        ticketId: cmd.ticketId,
        detail: cmd.ref.number,
      };
    default:
      return null;
  }
}

const meta = (id: string, key: string, name: string, folder: string | null, color: string): ProjectMeta => ({
  id,
  key,
  name,
  folder,
  color,
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
});

export function createMemoryDaemon(user: string, today: string): MemoryDaemon {
  const docs = new Map<string, { meta: ProjectMeta; doc: ReturnType<typeof createProjectDoc> }>();
  const inbox = meta(INBOX_ID, INBOX_KEY, "Boîte de réception", null, "#71717A");
  docs.set(INBOX_ID, { meta: inbox, doc: createProjectDoc(inbox) });
  let writes = 0;
  let workspaceName: string | null = null;
  const events: MemoryEvent[] = [];
  const agent = createMemoryAgent();
  agent.onProposed((batch) => events.push({ kind: "batch_proposed", ticketId: null, detail: batch.seq }));
  const project = (id: string) => {
    const found = docs.get(id);
    if (found === undefined) throw new KiboError("NOT_FOUND", `project ${id} not found`);
    return found;
  };
  const listed = () => [...docs.values()].map((p) => p.meta).filter((m) => m.id !== INBOX_ID);
  let deliveries = 0;
  const handle = (req: RpcRequest): unknown => {
    switch (req.method) {
      case "getSession":
        return { user, notifications: "browser" };
      case "listProjects":
        return listed();
      case "getConfig":
        return { workspaceName };
      case "getProject":
        return readProject(project(req.projectId).doc, today);
      case "createProject": {
        writes += 1;
        const created = meta(crypto.randomUUID(), req.key, req.name, req.folder, req.color);
        docs.set(created.id, { meta: created, doc: createProjectDoc(created) });
        return created;
      }
      case "command": {
        writes += 1;
        const result = executeProjectCommand(project(req.projectId).doc, req.command);
        const event = eventOf(req.command);
        if (event !== null) events.push(event);
        return result;
      }
      case "updateProject": {
        writes += 1;
        const found = project(req.projectId);
        found.meta = setProjectMeta(found.doc, req.patch);
        return found.meta;
      }
      case "sendProjectAgentMessage":
        writes += 1;
        return agent.send(req.projectId, readProject(project(req.projectId).doc, today));
      case "getProjectAgent":
        return agent.view(req.projectId);
      case "setDeliveryStep": {
        writes += 1;
        const { doc } = project(req.projectId);
        const ticket = readProject(doc, today).tickets.find((t) => t.key === req.ticketKey);
        if (ticket === undefined) throw new KiboError("NOT_FOUND", `ticket ${req.ticketKey} not found`);
        deliveries += 1;
        events.push({ kind: "step_set", ticketId: ticket.id, detail: req.step });
        const delivery = {
          step: req.step,
          note: req.note ?? "",
          at: deliveries,
          runId: null,
          kind: req.kind ?? "delivery",
        };
        return executeProjectCommand(doc, { method: "setTicketDelivery", ticketId: ticket.id, delivery });
      }
      case "config":
        writes += 1;
        if (req.command.method !== "updateWorkspace")
          throw new KiboError("INVALID_INPUT", `${req.command.method} is not simulated`);
        workspaceName = req.command.patch.name ?? workspaceName;
        return { name: workspaceName, description: null };
      default:
        throw new KiboError("INVALID_INPUT", `${req.method} is not simulated`);
    }
  };
  return {
    rpc: async (req) => handle(RpcRequest.parse(req)),
    writes: () => writes,
    snapshot(key, day) {
      const found = [...docs.values()].find((p) => p.meta.key === key);
      if (found === undefined) throw new KiboError("NOT_FOUND", `project ${key} not found`);
      return readProject(found.doc, day);
    },
    workspaceName: () => workspaceName,
    projects: listed,
    events: () => [...events],
    agentView: agent.view,
  };
}
