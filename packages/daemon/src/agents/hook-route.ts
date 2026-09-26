import { type GuardDecision, type HookPayload, HookPost, KiboError } from "@kibo/schema";

export type HookSink = {
  verify(runId: string, token: string): boolean;
  receive(
    runId: string,
    payload: HookPayload,
    toolInput: Record<string, unknown> | null,
  ): GuardDecision | null;
};

export const MAX_HOOK_BYTES = 262_144;

const BEARER = /^Bearer ([0-9a-f]{64})$/;
const TOO_LARGE = () => new Response("payload too large", { status: 413 });

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readBounded(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || declared > MAX_HOOK_BYTES) return null;
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_HOOK_BYTES) return null;
  return new TextDecoder().decode(bytes);
}

export async function handleHook(req: Request, runId: string, sink: HookSink): Promise<Response> {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const token = BEARER.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token || !sink.verify(runId, token)) return new Response("unauthorized", { status: 401 });
  const text = await readBounded(req);
  if (text === null) return TOO_LARGE();
  const parsed = HookPost.safeParse(parseJson(text));
  if (!parsed.success) return new Response("invalid hook payload", { status: 400 });
  const { payload, toolInput } = parsed.data;
  let decision: GuardDecision | null;
  try {
    decision = sink.receive(runId, payload, payload.event === "PreToolUse" ? toolInput : null);
  } catch (e) {
    if (e instanceof KiboError) return new Response(e.code, { status: 409 });
    throw e;
  }
  if (!decision || payload.event !== "PreToolUse") return new Response(null, { status: 204 });
  return Response.json({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision.decision,
      permissionDecisionReason: decision.reason,
    },
  });
}
