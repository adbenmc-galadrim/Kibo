import { type AgentMcpReply, AgentMcpRequest, KiboError } from "@kibo/schema";
import { STATUS } from "../http-response";
import { parseJson, readBounded } from "../read-bounded";
import type { AgentMcpSink } from "./types";

export const AGENT_MCP_PATH = /^\/agent-mcp\/([0-9a-f-]{36})$/;
export const MAX_AGENT_MCP_BYTES = 262_144;

const BEARER = /^Bearer ([0-9a-f]{64})$/;

const reply = (body: AgentMcpReply, status = 200) => Response.json(body, { status });
const refusal = (e: KiboError) =>
  reply({ ok: false, error: { code: e.code, message: e.detail } }, STATUS[e.code] ?? 403);

function verified(req: Request, runId: string, sink: AgentMcpSink): Response | null {
  const token = BEARER.exec(req.headers.get("authorization") ?? "")?.[1];
  try {
    if (token && sink.verify(runId, token)) return null;
  } catch (e) {
    if (e instanceof KiboError) return refusal(e);
    throw e;
  }
  return new Response("unauthorized", { status: 401 });
}

async function answer(runId: string, req: AgentMcpRequest, sink: AgentMcpSink): Promise<Response> {
  try {
    return reply({ ok: true, text: await sink.call(runId, req) });
  } catch (e) {
    if (e instanceof KiboError) return reply({ ok: false, error: { code: e.code, message: e.detail } });
    console.error(`[kibo-daemon] agent tool ${req.tool} of run ${runId} failed`, e);
    return reply({ ok: false, error: { code: "INTERNAL", message: "internal error" } });
  }
}

export async function handleAgentMcp(req: Request, runId: string, sink: AgentMcpSink): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const refused = verified(req, runId, sink);
  if (refused) return refused;
  const text = await readBounded(req, MAX_AGENT_MCP_BYTES);
  if (text === null) return new Response("payload too large", { status: 413 });
  const parsed = AgentMcpRequest.safeParse(parseJson(text));
  if (!parsed.success) return new Response("invalid tool call", { status: 400 });
  return answer(runId, parsed.data, sink);
}
