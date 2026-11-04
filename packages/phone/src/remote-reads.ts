import type { AgentSnapshot, ProjectsIndex } from "@kibo/remote";
import {
  type CiRun,
  type ComponentCall,
  DEFAULT_COMPONENT_SETTINGS,
  KiboError,
  type ProjectAgentView,
  type ProjectEvent,
  type ProjectEventPage,
  type ProjectSnapshot,
  type ProjectSummary,
  projectInfo,
  type RpcRequest,
  type T3Status,
} from "@kibo/schema";
import { authenticatedJson } from "./authenticated";
import type { InstanceDataStore } from "./instance-data";
import { redated } from "./late-features";

export type SnapshotReader = {
  index(): Promise<ProjectsIndex>;
  open(projectId: string, kind: string): Promise<unknown>;
  has(projectId: string, kind: string): boolean;
  projectIds(): string[];
};

type ReadDeps = { reader: SnapshotReader; data: InstanceDataStore; today(): string };
type Served = { value: unknown } | null;

const DEFAULT_EVENTS_LIMIT = 50;

const project = async (r: SnapshotReader, projectId: string) =>
  authenticatedJson<ProjectSnapshot>(await r.open(projectId, "project"));
const agent = async (r: SnapshotReader, projectId: string) =>
  authenticatedJson<AgentSnapshot>(await r.open(projectId, "agent"));

function agentView({ view, pastBatches }: AgentSnapshot, runId: string | undefined): ProjectAgentView {
  if (runId === undefined || runId === view.session?.runId) return view;
  const session = view.past.find((s) => s.runId === runId);
  if (!session) throw new KiboError("NOT_FOUND", `project agent session ${runId} not found`);
  return { ...view, session, run: null, batches: pastBatches?.[runId] ?? [] };
}

function countByStatus(snapshot: ProjectSnapshot): ProjectSummary["counts"] {
  const counts: Record<string, number> = Object.fromEntries(snapshot.workflow.map((s) => [s.id, 0]));
  for (const t of snapshot.tickets) counts[t.statusId] = (counts[t.statusId] ?? 0) + 1;
  return counts;
}

async function listProjects(r: SnapshotReader): Promise<ProjectSummary[]> {
  const index = await r.index();
  const present = index.projects.filter((p) => r.has(p.id, "project"));
  return Promise.all(
    present.map(async (p) => {
      const snapshot = await project(r, p.id);
      return { ...snapshot.meta, icon: p.icon, counts: countByStatus(snapshot) };
    }),
  );
}

type EventsQuery = Extract<RpcRequest, { method: "listProjectEvents" }>;

async function listEvents(r: SnapshotReader, q: EventsQuery): Promise<ProjectEventPage> {
  const all = r.has(q.projectId, "events")
    ? authenticatedJson<ProjectEvent[]>(await r.open(q.projectId, "events"))
    : [];
  const limit = q.limit ?? DEFAULT_EVENTS_LIMIT;
  const matching = all
    .filter(
      (e) =>
        (q.before === undefined || e.id < q.before) &&
        (q.ticketId === undefined || e.ticketId === q.ticketId) &&
        (q.featureId === undefined || e.featureId === q.featureId) &&
        (q.sources === undefined || q.sources.includes(e.source)),
    )
    .sort((a, b) => b.id - a.id);
  const items = matching.slice(0, limit);
  return { items, nextBefore: matching.length > limit ? (items.at(-1)?.id ?? null) : null };
}

async function listCiRuns(r: SnapshotReader, projectId: string, ticketId: string | null): Promise<CiRun[]> {
  if (!r.has(projectId, "ci")) return [];
  const runs = authenticatedJson<CiRun[]>(await r.open(projectId, "ci"));
  if (ticketId === null) return runs;
  const key = (await project(r, projectId)).tickets.find((t) => t.id === ticketId)?.key ?? null;
  return runs.filter((run) => run.ticketKey !== null && run.ticketKey === key);
}

async function runLog(r: SnapshotReader, runId: string): Promise<unknown> {
  for (const projectId of r.projectIds()) {
    if (!r.has(projectId, "agent")) continue;
    const logs = (await agent(r, projectId)).logs[runId];
    if (logs) return logs;
  }
  return [];
}

async function t3Status(r: SnapshotReader, projectId: string | null): Promise<Served> {
  const owner = projectId ?? r.projectIds().find((id) => r.has(id, "t3"));
  if (owner === undefined || !r.has(owner, "t3")) return null;
  return { value: authenticatedJson<T3Status>(await r.open(owner, "t3")) };
}

function dataCall(deps: ReadDeps, projectId: string, instanceId: string, call: ComponentCall): Served {
  switch (call.kind) {
    case "data.get":
      return { value: deps.data.get(projectId, instanceId, call.key) };
    case "data.set":
      deps.data.set(projectId, instanceId, call.key, call.value);
      return { value: null };
    case "data.delete":
      deps.data.delete(projectId, instanceId, call.key);
      return { value: null };
    case "data.keys":
      return { value: deps.data.keys(projectId, instanceId) };
    case "settings.get":
      return { value: DEFAULT_COMPONENT_SETTINGS };
    default:
      return null;
  }
}

async function listEntity(r: SnapshotReader, projectId: string, entity: string): Promise<Served> {
  if (entity === "ci_run") return { value: await listCiRuns(r, projectId, null) };
  if (entity !== "project_event") return null;
  if (!r.has(projectId, "events")) return { value: [] };
  return { value: authenticatedJson<ProjectEvent[]>(await r.open(projectId, "events")) };
}

async function componentRead(deps: ReadDeps, projectId: string, call: ComponentCall): Promise<Served> {
  const r = deps.reader;
  switch (call.kind) {
    case "project.get":
      return { value: projectInfo(await project(r, projectId), deps.today()) };
    case "questions.recipients":
      return { value: (await project(r, projectId)).questionRecipients };
    case "t3.status":
      return t3Status(r, projectId);
    case "list":
      return listEntity(r, projectId, call.entity);
    default:
      return null;
  }
}

export const READ_LOCALLY = [
  "getSession",
  "listProjects",
  "getProject",
  "listProjectEvents",
  "listCiRuns",
  "getProjectAgent",
  "getRunLog",
  "t3.status",
] as const satisfies readonly RpcRequest["method"][];

export const isLocalCall = (call: ComponentCall): boolean =>
  call.kind.startsWith("data.") || call.kind === "settings.get";

export async function serveLocally(deps: ReadDeps, req: RpcRequest): Promise<Served> {
  const r = deps.reader;
  switch (req.method) {
    case "getSession":
      return { value: { user: (await r.index()).viewer, notifications: "browser" } };
    case "listProjects":
      return { value: await listProjects(r) };
    case "getProject":
      return { value: redated(await project(r, req.projectId), deps.today()) };
    case "listProjectEvents":
      return { value: await listEvents(r, req) };
    case "listCiRuns":
      return { value: await listCiRuns(r, req.projectId, req.ticketId) };
    case "getProjectAgent":
      return { value: agentView(await agent(r, req.projectId), req.runId) };
    case "getRunLog":
      return { value: await runLog(r, req.runId) };
    case "t3.status":
      return t3Status(r, null);
    case "componentCall":
      return (
        dataCall(deps, req.projectId, req.instanceId, req.call) ??
        componentRead(deps, req.projectId, req.call)
      );
    default:
      return null;
  }
}
