import { z } from "zod";
import type { AppInfo, Diagnostics } from "./app-info";
import { BackupId, type BackupInfo, type BackupStatus } from "./backup";
import { type TutorialState, TutorialStep } from "./tutorial";

export const PHASE14_RPC = [
  z.object({ method: z.literal("getAppInfo") }),
  z.object({ method: z.literal("getDiagnostics") }),
  z.object({ method: z.literal("getBackups") }),
  z.object({
    method: z.literal("setBackupSettings"),
    patch: z
      .object({ enabled: z.boolean().optional(), dir: z.string().min(1).max(1024).nullable().optional() })
      .strict(),
  }),
  z.object({ method: z.literal("createBackup"), reason: z.enum(["manual", "update"]) }),
  z.object({ method: z.literal("deleteBackup"), id: BackupId }),
  z.object({ method: z.literal("getTutorial") }),
  z.object({ method: z.literal("startTutorial") }),
  z.object({ method: z.literal("pauseTutorial") }),
  z.object({ method: z.literal("skipTutorial") }),
  z.object({ method: z.literal("resetTutorial") }),
  z.object({ method: z.literal("skipTutorialStep"), step: TutorialStep }),
  z.object({ method: z.literal("markTutorialSeen"), view: z.literal("graph") }),
] as const;

export type Phase14RpcResult = {
  getAppInfo: AppInfo;
  getDiagnostics: Diagnostics;
  getBackups: { status: BackupStatus; backups: BackupInfo[] };
  setBackupSettings: BackupStatus;
  createBackup: BackupInfo;
  deleteBackup: null;
  getTutorial: TutorialState;
  startTutorial: TutorialState;
  pauseTutorial: TutorialState;
  skipTutorial: TutorialState;
  resetTutorial: TutorialState;
  skipTutorialStep: TutorialState;
  markTutorialSeen: TutorialState;
};
