import { AppSettingsPatch, type ChangeMessage, KiboError, type RpcRequest } from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { AppSettingsStore } from "./app-settings-store";

type AppSettingsRpcDeps = { store: AppSettingsStore; emit(message: ChangeMessage): void };

function parsePatch(patch: unknown): AppSettingsPatch {
  const parsed = AppSettingsPatch.safeParse(patch);
  if (!parsed.success) throw new KiboError("INVALID_INPUT", `invalid app settings: ${parsed.error.message}`);
  if (parsed.data.agentExecution !== undefined)
    throw new KiboError("AGENT_EXECUTION_REMOVED", "setAppSettings: Kibo no longer runs ticket agents");
  return parsed.data;
}

export function appSettingsRpc(deps: AppSettingsRpcDeps): RpcExtension {
  return {
    methods: ["getAppSettings", "setAppSettings"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      if (req.method === "getAppSettings") return deps.store.get();
      if (req.method === "setAppSettings") {
        requireLocal(ctx);
        const settings = deps.store.set(parsePatch(req.patch));
        deps.emit({ topic: "config" });
        return settings;
      }
      throw new KiboError("INTERNAL", `appSettingsRpc cannot handle ${req.method}`);
    },
  };
}
