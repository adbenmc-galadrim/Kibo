import { basename } from "node:path";
import { type RpcRequest, T3Launch, T3Preview } from "@kibo/schema";
import { threadStartIn } from "../t3/compose-command";

type Ask = (req: RpcRequest) => Promise<unknown>;
type T3Kind = "t3.preview" | "t3.launch";
type T3Target = { kind: T3Kind; ticketKey: string };

export const folderName = (folder: string | null): string | null =>
  folder === null ? null : basename(folder);

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

function withFolderName(result: unknown): unknown {
  if (typeof result !== "object" || result === null || !("meta" in result)) return result;
  const { meta } = result;
  if (typeof meta !== "object" || meta === null || !("folder" in meta) || typeof meta.folder !== "string")
    return result;
  return { ...result, meta: { ...meta, folder: basename(meta.folder) } };
}

export async function answerPhone(req: RpcRequest, ask: Ask): Promise<unknown> {
  const target = t3Target(req);
  if (target === null || !("projectId" in req)) {
    const result = await ask(req);
    return req.method === "getProject" ? withFolderName(result) : result;
  }
  if (target.kind === "t3.preview") return phonePreview(T3Preview.parse(await ask(req)), target.ticketKey);
  const preview = T3Preview.parse(await ask(previewRequest(req, target.ticketKey)));
  const launch = T3Launch.parse(await ask(req));
  return { ...launch, command: phonePreview(preview, target.ticketKey).command };
}
