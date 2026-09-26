import { KiboError, type RpcRequest } from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { PairingCodes } from "./pairing-codes";
import type { RemoteAccess } from "./remote-access";

export const REMOTE_METHODS = [
  "getRemoteAccess",
  "enableRemoteAccess",
  "disableRemoteAccess",
  "createPairingCode",
] as const satisfies readonly RpcRequest["method"][];

export function remoteRpc(remote: () => RemoteAccess, codes: PairingCodes): RpcExtension {
  return {
    methods: REMOTE_METHODS,
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      switch (req.method) {
        case "getRemoteAccess":
          return remote().status();
        case "enableRemoteAccess":
          requireLocal(ctx);
          return remote().enable({ address: req.address, port: req.port, tls: req.tls });
        case "disableRemoteAccess":
          requireLocal(ctx);
          await remote().disable();
          return null;
        case "createPairingCode":
          requireLocal(ctx);
          return codes.create();
        default:
          throw new KiboError("INTERNAL", `remoteRpc cannot handle ${req.method}`);
      }
    },
  };
}
