import { type ChangeMessage, KiboError, type RpcRequest, type SessionInfo } from "@kibo/schema";
import type { RpcContext, RpcExtension } from "../rpc-extensions";
import type { SessionStore } from "./session-store";

export function sessionRpc(
  store: SessionStore,
  emit: (m: ChangeMessage) => void,
  now: () => number,
): RpcExtension {
  return {
    methods: ["listSessions", "revokeSession"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      if (req.method === "listSessions") {
        return store.list(now()).map((s): SessionInfo => ({ ...s, current: s.id === ctx.sessionHash }));
      }
      if (req.method === "revokeSession") {
        store.revoke(req.id, now());
        emit({ type: "sessions.changed" });
        return null;
      }
      throw new KiboError("INTERNAL", `sessionRpc cannot handle ${req.method}`);
    },
  };
}
