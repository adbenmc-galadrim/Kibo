import { KiboError, type RpcRequest } from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { SandboxService } from "./sandbox-service";

export function sandboxRpc(service: SandboxService): RpcExtension {
  return {
    methods: ["getSandboxStatus", "setAllowUnsandboxed"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      if (req.method === "getSandboxStatus") return service.status();
      if (req.method === "setAllowUnsandboxed") {
        requireLocal(ctx);
        return service.setAllowUnsandboxed(req.allow);
      }
      throw new KiboError("INTERNAL", `sandboxRpc cannot handle ${req.method}`);
    },
  };
}
