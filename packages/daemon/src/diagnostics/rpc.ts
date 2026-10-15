import { type AppInfo, type Diagnostics, KiboError, type RpcRequest } from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";

type AppRpcDeps = { appInfo(): AppInfo; userHome: string; diagnostics(): Promise<Diagnostics> };

export function appRpc(deps: AppRpcDeps): RpcExtension {
  return {
    methods: ["getAppInfo", "getDiagnostics"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      if (req.method === "getAppInfo")
        return ctx.remote ? deps.appInfo() : { ...deps.appInfo(), userHome: deps.userHome };
      if (req.method === "getDiagnostics") {
        requireLocal(ctx);
        return deps.diagnostics();
      }
      throw new KiboError("INTERNAL", `appRpc cannot handle ${req.method}`);
    },
  };
}
