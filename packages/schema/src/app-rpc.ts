import { z } from "zod";
import type { Environment } from "./ai";
import type { AppInfo, Diagnostics } from "./app-info";
import { BackupId, type BackupInfo, type BackupStatus } from "./backup";

export const APP_RPC = [
  z.object({ method: z.literal("getAppInfo") }),
  z.object({ method: z.literal("getDiagnostics") }),
  z.object({ method: z.literal("getEnvironment") }),
  z.object({ method: z.literal("getBackups") }),
  z.object({
    method: z.literal("setBackupSettings"),
    patch: z
      .object({ enabled: z.boolean().optional(), dir: z.string().min(1).max(1024).nullable().optional() })
      .strict(),
  }),
  z.object({ method: z.literal("createBackup"), reason: z.enum(["manual", "update"]) }),
  z.object({ method: z.literal("deleteBackup"), id: BackupId }),
] as const;

export type AppRpcResult = {
  getAppInfo: AppInfo;
  getDiagnostics: Diagnostics;
  getEnvironment: Environment;
  getBackups: { status: BackupStatus; backups: BackupInfo[] };
  setBackupSettings: BackupStatus;
  createBackup: BackupInfo;
  deleteBackup: null;
};
