import { createProjectDoc, executeProjectCommand, readProject } from "../../packages/core/src/index";
import {
  INBOX_ID,
  INBOX_KEY,
  KiboError,
  type ProjectMeta,
  type ProjectSnapshot,
  RpcRequest,
} from "../../packages/schema/src/index";
import type { SeedRpc } from "../seed-emis-maquettes";

export type MemoryDaemon = {
  rpc: SeedRpc;
  writes(): number;
  snapshot(key: string, today: string): ProjectSnapshot;
  workspaceName(): string | null;
  projects(): ProjectMeta[];
};

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
});

export function createMemoryDaemon(user: string, today: string): MemoryDaemon {
  const docs = new Map<string, { meta: ProjectMeta; doc: ReturnType<typeof createProjectDoc> }>();
  const inbox = meta(INBOX_ID, INBOX_KEY, "Boîte de réception", null, "#71717A");
  docs.set(INBOX_ID, { meta: inbox, doc: createProjectDoc(inbox) });
  let writes = 0;
  let workspaceName: string | null = null;
  const project = (id: string) => {
    const found = docs.get(id);
    if (found === undefined) throw new KiboError("NOT_FOUND", `project ${id} not found`);
    return found;
  };
  const listed = () => [...docs.values()].map((p) => p.meta).filter((m) => m.id !== INBOX_ID);
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
      case "command":
        writes += 1;
        return executeProjectCommand(project(req.projectId).doc, req.command);
      case "setDeliveryStep": {
        writes += 1;
        const { doc } = project(req.projectId);
        const ticket = readProject(doc, today).tickets.find((t) => t.key === req.ticketKey);
        if (ticket === undefined) throw new KiboError("NOT_FOUND", `ticket ${req.ticketKey} not found`);
        const delivery = { step: req.step, note: req.note ?? "", at: 0, runId: null };
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
  };
}
