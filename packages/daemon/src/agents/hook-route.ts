import { type HookEventName, type HookPayload, HookPost, type HookReply, KiboError } from "@kibo/schema";
import { parseJson, readBounded } from "../read-bounded";

export type HookSink = {
  verify(runId: string, token: string): boolean;
  receive(runId: string, payload: HookPayload, toolInput: Record<string, unknown> | null): HookReply | null;
};

export const MAX_HOOK_BYTES = 262_144;

const BEARER = /^Bearer ([0-9a-f]{64})$/;
const TOO_LARGE = () => new Response("payload too large", { status: 413 });

export async function handleHook(req: Request, runId: string, sink: HookSink): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const token = BEARER.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token || !sink.verify(runId, token)) return new Response("unauthorized", { status: 401 });
  const text = await readBounded(req, MAX_HOOK_BYTES);
  if (text === null) return TOO_LARGE();
  const parsed = HookPost.safeParse(parseJson(text));
  if (!parsed.success) return new Response("invalid hook payload", { status: 400 });
  const { payload, toolInput } = parsed.data;
  let reply: HookReply | null;
  try {
    reply = sink.receive(runId, payload, payload.event === "PreToolUse" ? toolInput : null);
  } catch (e) {
    if (e instanceof KiboError) return new Response(e.code, { status: 409 });
    throw e;
  }
  const body = reply ? replyBody(payload.event, reply) : null;
  return body ? Response.json(body) : new Response(null, { status: 204 });
}

function replyBody(event: HookEventName, reply: HookReply): Record<string, unknown> | null {
  if (reply.kind === "stop") return event === "Stop" ? { decision: "block", reason: reply.reason } : null;
  if (event !== "PreToolUse") return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: reply.decision,
      permissionDecisionReason: reply.reason,
      ...(reply.additionalContext === null ? {} : { additionalContext: reply.additionalContext }),
    },
  };
}
