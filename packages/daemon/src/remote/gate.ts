import { assertRemoteAllowed, REQUEST_CLOCK_REFUSAL, type RequestHeader } from "@kibo/remote";
import { KiboError, RpcRequest, type RpcResponse } from "@kibo/schema";
import { HIDDEN } from "../http-response";
import type { RpcContext } from "../rpc-extensions";
import { rpcRefusal } from "../rpc-refusal";
import { answerPhone } from "./phone-view";
import { REPLAY_WINDOW_MS, type ReplayGuard } from "./replay-guard";

const PHONE_CONTEXT: RpcContext = { sessionHash: "phone", remote: true };

type GateDeps = {
  dispatch(req: RpcRequest, ctx: RpcContext): Promise<unknown>;
  seen: ReplayGuard;
  startedAt: number;
  now(): number;
  redact(text: string): string;
};

type Origin = Pick<RequestHeader, "requestId" | "at">;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new KiboError("INVALID_INPUT", "invalid request: not json");
  }
}

function parseRequest(plaintext: Uint8Array): RpcRequest {
  const parsed = RpcRequest.safeParse(parseJson(new TextDecoder().decode(plaintext)));
  if (!parsed.success) throw new KiboError("INVALID_INPUT", rpcRefusal(parsed.error));
  return parsed.data;
}

function assertFresh(deps: GateDeps, origin: Origin): void {
  const now = deps.now();
  if (Math.abs(now - origin.at) > REPLAY_WINDOW_MS) {
    throw new KiboError("REMOTE_REJECTED", REQUEST_CLOCK_REFUSAL);
  }
  if (origin.at < deps.startedAt) {
    throw new KiboError("REMOTE_REJECTED", "request predates the daemon start");
  }
  if (deps.seen.seen(origin.requestId, origin.at, now)) {
    throw new KiboError("REMOTE_REJECTED", "request was already received");
  }
}

function failure(e: unknown, redact: GateDeps["redact"]): RpcResponse {
  if (e instanceof KiboError && !HIDDEN.has(e.code)) {
    return { ok: false, error: { code: e.code, message: redact(e.detail) } };
  }
  console.error("[kibo-daemon] remote request failed", e);
  return { ok: false, error: { code: "INTERNAL", message: "internal error" } };
}

async function answer(deps: GateDeps, plaintext: Uint8Array, origin: Origin): Promise<RpcResponse> {
  try {
    assertFresh(deps, origin);
    const req = parseRequest(plaintext);
    assertRemoteAllowed(req);
    const ask = (asked: RpcRequest) => deps.dispatch(asked, PHONE_CONTEXT);
    return { ok: true, result: (await answerPhone(req, ask)) ?? null };
  } catch (e) {
    return failure(e, deps.redact);
  }
}

export async function handleRemoteRequest(
  deps: GateDeps,
  plaintext: Uint8Array,
  origin: Origin,
): Promise<Uint8Array> {
  return new TextEncoder().encode(JSON.stringify(await answer(deps, plaintext, origin)));
}
