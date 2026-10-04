import { KiboError, type RpcRequest } from "@kibo/schema";
import { type RpcContext, type RpcExtension, requireLocal } from "../rpc-extensions";
import type { BackupsService } from "./service";

export function backupsRpc(service: BackupsService): RpcExtension {
  return {
    methods: ["getBackups", "setBackupSettings", "createBackup", "deleteBackup"],
    async handle(req: RpcRequest, ctx: RpcContext): Promise<unknown> {
      requireLocal(ctx);
      if (req.method === "getBackups") {
        const [status, backups] = await Promise.all([service.status(), service.list()]);
        return { status, backups: backups.reverse() };
      }
      if (req.method === "setBackupSettings") return service.setSettings(req.patch);
      if (req.method === "createBackup") return service.create(req.reason);
      if (req.method === "deleteBackup") {
        await service.remove(req.id);
        return null;
      }
      throw new KiboError("INTERNAL", `backupsRpc cannot handle ${req.method}`);
    },
  };
}
