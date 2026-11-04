import { basename } from "node:path";
import {
  type ProjectAgentView,
  type ProjectMeta,
  type RpcRequest,
  type RpcResult,
  type RunLogEntry,
  type RunView,
  T3Launch,
  T3Preview,
  T3Status,
} from "@kibo/schema";
import { threadStartIn } from "../t3/compose-command";
import type { LocalRpc } from "./snapshot-builder";

type Ask = (req: RpcRequest) => Promise<unknown>;
type T3Kind = "t3.preview" | "t3.launch";
type T3Target = { kind: T3Kind; ticketKey: string };
type PhoneT3Status = Pick<T3Status, "available" | "reason">;

export const trustDaemonDispatch =
  (ask: Ask): LocalRpc =>
  async (req) =>
    (await ask(req)) as RpcResult[typeof req.method];

const folderName = (folder: string | null): string | null => (folder === null ? null : basename(folder));

export const phoneMeta = <M extends ProjectMeta>(meta: M): M => ({
  ...meta,
  folder: folderName(meta.folder),
  worktree: null,
  storybook: null,
  delivery: null,
});

const phoneRun = (run: RunView | null): RunView | null =>
  run && { ...run, workspace: null, cwd: null, transcriptPath: null };

export const phoneAgentView = (view: ProjectAgentView): ProjectAgentView => ({
  ...view,
  run: phoneRun(view.run),
  memoryPath: "",
});

export function phoneLogEntry(entry: RunLogEntry): RunLogEntry {
  const { event } = entry;
  if (event.type === "hook")
    return { ...entry, event: { ...event, payload: { ...event.payload, transcriptPath: null } } };
  if (event.type !== "spawned") return entry;
  const { cwd: _cwd, addDirs: _addDirs, ...spawned } = event;
  return { ...entry, event: { ...spawned, workspace: "" } };
}

export const phoneT3Status = ({ available, reason }: T3Status): PhoneT3Status =>
  reason === undefined ? { available } : { available, reason };

function t3Target(req: RpcRequest): T3Target | null {
  if (req.method === "t3.preview" || req.method === "t3.launch")
    return { kind: req.method, ticketKey: req.ticketKey };
  if (req.method !== "componentCall") return null;
  const { call } = req;
  if (call.kind === "t3.preview" || call.kind === "t3.launch")
    return { kind: call.kind, ticketKey: call.ticketKey };
  return null;
}

const previewRequest = (req: RpcRequest & { projectId: string }, ticketKey: string): RpcRequest =>
  req.method === "componentCall"
    ? { ...req, call: { kind: "t3.preview", ticketKey } }
    : { method: "t3.preview", projectId: req.projectId, ticketKey };

function phonePreview(preview: T3Preview, ticketKey: string): T3Preview {
  const name = basename(preview.folder);
  return { argv: [], command: threadStartIn(name, ticketKey), folder: name, warning: preview.warning };
}

async function answerT3(req: RpcRequest & { projectId: string }, target: T3Target, ask: Ask) {
  if (target.kind === "t3.preview") return phonePreview(T3Preview.parse(await ask(req)), target.ticketKey);
  const preview = T3Preview.parse(await ask(previewRequest(req, target.ticketKey)));
  const launch = T3Launch.parse(await ask(req));
  return { ...launch, command: phonePreview(preview, target.ticketKey).command };
}

async function answerRead(req: RpcRequest, ask: Ask): Promise<unknown> {
  const rpc = trustDaemonDispatch(ask);
  switch (req.method) {
    case "listProjects":
      return (await rpc(req)).map(phoneMeta);
    case "getProject": {
      const snapshot = await rpc(req);
      return { ...snapshot, meta: phoneMeta(snapshot.meta) };
    }
    case "getProjectAgent":
      return phoneAgentView(await rpc(req));
    case "sendProjectAgentMessage":
      return phoneRun(await rpc(req));
    case "getRunLog":
      return (await rpc(req)).map(phoneLogEntry);
    case "t3.status":
      return phoneT3Status(await rpc(req));
    case "componentCall":
      return req.call.kind === "t3.status" ? phoneT3Status(T3Status.parse(await ask(req))) : ask(req);
    default:
      return ask(req);
  }
}

export async function answerPhone(req: RpcRequest, ask: Ask): Promise<unknown> {
  const target = t3Target(req);
  if (target === null || !("projectId" in req)) return answerRead(req, ask);
  return answerT3(req, target, ask);
}
