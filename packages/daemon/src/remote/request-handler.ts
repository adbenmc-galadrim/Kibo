import {
  type MacMessage,
  openRequest,
  type RemoteKeys,
  type RequestHeader,
  type ServerMessage,
  sealReply,
} from "@kibo/remote";
import { KiboError, type RpcResponse } from "@kibo/schema";
import { handleRemoteRequest } from "./gate";

type GateDeps = Parameters<typeof handleRemoteRequest>[0];
type RequestMessage = Extract<ServerMessage, { type: "request" }>;
type Reply = Extract<MacMessage, { type: "request.reply" }>;

type RequestHandlerDeps = { keys(): RemoteKeys | null; gate: GateDeps };

const utf8 = new TextEncoder();

const rejected = (detail: string): Uint8Array => {
  const response: RpcResponse = { ok: false, error: { code: "REMOTE_REJECTED", message: detail } };
  return utf8.encode(JSON.stringify(response));
};

async function answer(
  deps: RequestHandlerDeps,
  keys: RemoteKeys,
  header: RequestHeader,
  sealed: RequestMessage["sealed"],
) {
  try {
    const plaintext = await openRequest(keys, sealed);
    return await handleRemoteRequest(deps.gate, plaintext, header);
  } catch (e) {
    if (e instanceof KiboError && e.code === "REMOTE_REJECTED") return rejected(e.detail);
    throw e;
  }
}

export function createRequestHandler(
  deps: RequestHandlerDeps,
): (message: RequestMessage) => Promise<Reply | null> {
  return async (message) => {
    const keys = deps.keys();
    if (!keys) return null;
    const header = message.sealed.header;
    const bytes = await answer(deps, keys, header, message.sealed);
    const replyHeader: RequestHeader = { ...header, keyEpoch: keys.epoch };
    return {
      type: "request.reply",
      requestId: message.requestId,
      sealed: await sealReply(keys, replyHeader, bytes),
    };
  };
}
