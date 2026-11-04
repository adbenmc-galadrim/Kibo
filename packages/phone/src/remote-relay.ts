import { REQUEST_CLOCK_REFUSAL, type RemoteKeys, sealRequest } from "@kibo/remote";
import { KIBO_ERROR_CODES, KiboError, type RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { openAnswer } from "./reply-answer";
import type { ServerApi } from "./server-api";

export type Connectivity = { macOnline: boolean; phoneOnline: boolean; reconnecting?: boolean };
export type RefusalReason = "macOff" | "phoneOffline" | "clock" | "timeout";
export type RefusalAction = "launch" | "message" | "write";
export type Refusal = { reason: RefusalReason; action: RefusalAction };

type RelayDeps = {
  api: ServerApi;
  keys(): RemoteKeys | null;
  connectivity(): Connectivity;
  now(): number;
  randomId(): string;
};

const Answer = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: z.enum(KIBO_ERROR_CODES), message: z.string() }),
  }),
]);

const WRITE_CALLS: ReadonlySet<string> = new Set(["run", "config.set", "t3.launch"]);
const WRITE_METHODS: ReadonlySet<string> = new Set([
  "command",
  "fileTicket",
  "sendProjectAgentMessage",
  "decideBatch",
  "t3.launch",
  "t3.refresh",
]);

export const isWrite = (req: RpcRequest): boolean =>
  WRITE_METHODS.has(req.method) || (req.method === "componentCall" && WRITE_CALLS.has(req.call.kind));

export function actionOf(req: RpcRequest): RefusalAction {
  if (req.method === "t3.launch" || (req.method === "componentCall" && req.call.kind === "t3.launch"))
    return "launch";
  return req.method === "sendProjectAgentMessage" ? "message" : "write";
}

export function reasonOf(error: unknown, connectivity: Connectivity): RefusalReason | null {
  if (!(error instanceof KiboError)) return null;
  if (error.code === "REMOTE_UNAVAILABLE") return connectivity.phoneOnline ? "macOff" : "phoneOffline";
  if (error.code === "TIMEOUT") return "timeout";
  if (error.code === "REMOTE_REJECTED" && error.detail === REQUEST_CLOCK_REFUSAL) return "clock";
  return null;
}

const projectOf = (req: RpcRequest): string | null =>
  "projectId" in req && typeof req.projectId === "string" ? req.projectId : null;

const encoder = new TextEncoder();

export function createRelay(deps: RelayDeps): (req: RpcRequest) => Promise<unknown> {
  return async (req) => {
    const keys = deps.keys();
    if (!keys) throw new KiboError("UNAUTHORIZED", "phone is not paired");
    const { macOnline, phoneOnline, reconnecting } = deps.connectivity();
    if (!phoneOnline) throw new KiboError("REMOTE_UNAVAILABLE", "phone is offline");
    if (!macOnline && !reconnecting) throw new KiboError("REMOTE_UNAVAILABLE", "mac is offline");
    const header = {
      v: 1 as const,
      requestId: deps.randomId(),
      projectId: projectOf(req),
      at: deps.now(),
      keyEpoch: keys.epoch,
    };
    const reply = await deps.api.request(
      await sealRequest(keys, header, encoder.encode(JSON.stringify(req))),
    );
    if (reply.header.requestId !== header.requestId)
      throw new KiboError("REMOTE_REJECTED", "reply does not match the request");
    const answer = await openAnswer(keys, reply, Answer);
    if (!answer.ok) throw new KiboError(answer.error.code, answer.error.message);
    return answer.result;
  };
}
