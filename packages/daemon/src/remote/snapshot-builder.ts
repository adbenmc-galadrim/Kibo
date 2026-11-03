import { type AgentSnapshot, INDEX_PROJECT_ID, type ProjectsIndex, type SnapshotKind } from "@kibo/remote";
import {
  isArchived,
  type ProjectSnapshot,
  type RpcRequest,
  type RpcResult,
  type RunLogEntry,
  type T3Status,
} from "@kibo/schema";
import type { QuestionImageFile } from "../questions/question-images";

const EVENTS_LIMIT = 200;
const INDEX_KIND = "projects";

export type SnapshotBlock = { projectId: string; kind: SnapshotKind; plaintext: Uint8Array };
export type BuildResult = { put: SnapshotBlock[]; removed: SnapshotKind[] };

export type LocalRpc = <M extends RpcRequest["method"]>(
  req: Extract<RpcRequest, { method: M }>,
) => Promise<RpcResult[M]>;

type BuilderDeps = {
  rpc: LocalRpc;
  readImage(questionId: string, imageId: string): QuestionImageFile | null;
};

export type SnapshotBuilder = {
  buildAll(projectId: string): Promise<BuildResult>;
  buildIndex(projectIds: readonly string[]): Promise<BuildResult>;
  forget(projectId: string): void;
  reset(): void;
};

type Content = { kind: SnapshotKind; value: unknown };

const utf8 = new TextEncoder();

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Buffer.from(digest).toString("hex");
}

const withoutLocalFolder = (snapshot: ProjectSnapshot): ProjectSnapshot => ({
  ...snapshot,
  meta: { ...snapshot.meta, folder: null },
});

function withoutLocalPaths(entry: RunLogEntry): RunLogEntry {
  if (entry.event.type !== "spawned") return entry;
  const { cwd: _cwd, addDirs: _addDirs, ...event } = entry.event;
  return { ...entry, event: { ...event, workspace: "" } };
}

const t3Content = ({ available, reason }: T3Status): Pick<T3Status, "available" | "reason"> =>
  reason === undefined ? { available } : { available, reason };

async function agentContent(rpc: LocalRpc, projectId: string): Promise<AgentSnapshot> {
  const view = await rpc({ method: "getProjectAgent", projectId });
  const runIds = [view.session?.runId, ...view.past.map((s) => s.runId)].filter(
    (id): id is string => typeof id === "string",
  );
  const logs: AgentSnapshot["logs"] = {};
  for (const runId of new Set(runIds))
    logs[runId] = (await rpc({ method: "getRunLog", runId })).map(withoutLocalPaths);
  const run = view.run && { ...view.run, workspace: null, cwd: null, transcriptPath: null };
  return { view: { ...view, run, memoryPath: "" }, logs };
}

function imageContents(deps: BuilderDeps, snapshot: ProjectSnapshot): Content[] {
  const contents: Content[] = [];
  for (const question of snapshot.questions) {
    if (isArchived(question)) continue;
    for (const image of question.images) {
      const file = deps.readImage(question.id, image.id);
      if (!file) continue;
      const value = { mime: file.mime, bytes: Buffer.from(file.bytes).toString("base64") };
      contents.push({ kind: `image:${question.id}:${image.id}`, value });
    }
  }
  return contents;
}

async function projectContents(deps: BuilderDeps, projectId: string): Promise<Content[]> {
  const { rpc } = deps;
  const snapshot = await rpc({ method: "getProject", projectId });
  const events = await rpc({ method: "listProjectEvents", projectId, limit: EVENTS_LIMIT });
  return [
    { kind: "project", value: withoutLocalFolder(snapshot) },
    { kind: "events", value: events.items },
    { kind: "agent", value: await agentContent(rpc, projectId) },
    { kind: "ci", value: await rpc({ method: "listCiRuns", projectId, ticketId: null }) },
    { kind: "t3", value: t3Content(await rpc({ method: "t3.status" })) },
    ...imageContents(deps, snapshot),
  ];
}

async function indexContent(rpc: LocalRpc, projectIds: readonly string[]): Promise<ProjectsIndex> {
  const enabled = new Set(projectIds);
  const session = await rpc({ method: "getSession" });
  const projects: ProjectsIndex["projects"] = [];
  for (const summary of await rpc({ method: "listProjects" })) {
    if (!enabled.has(summary.id)) continue;
    const { pages } = await rpc({ method: "getProject", projectId: summary.id });
    projects.push({
      id: summary.id,
      name: summary.name,
      key: summary.key,
      icon: summary.icon ?? null,
      pages,
    });
  }
  return { viewer: session.user, projects };
}

export function createSnapshotBuilder(deps: BuilderDeps): SnapshotBuilder {
  const hashes = new Map<string, Map<SnapshotKind, string>>();
  const diff = async (projectId: string, contents: Content[], scoped: boolean): Promise<BuildResult> => {
    const previous = hashes.get(projectId) ?? new Map<SnapshotKind, string>();
    const next = new Map<SnapshotKind, string>();
    const put: SnapshotBlock[] = [];
    for (const { kind, value } of contents) {
      const plaintext = utf8.encode(JSON.stringify(value));
      const hash = await sha256(plaintext);
      next.set(kind, hash);
      if (previous.get(kind) !== hash) put.push({ projectId, kind, plaintext });
    }
    const removed = scoped ? [...previous.keys()].filter((kind) => !next.has(kind)) : [];
    hashes.set(projectId, next);
    return { put, removed };
  };
  return {
    buildAll: async (projectId) => diff(projectId, await projectContents(deps, projectId), true),
    buildIndex: async (projectIds) =>
      diff(INDEX_PROJECT_ID, [{ kind: INDEX_KIND, value: await indexContent(deps.rpc, projectIds) }], false),
    forget: (projectId) => {
      hashes.delete(projectId);
    },
    reset: () => hashes.clear(),
  };
}
