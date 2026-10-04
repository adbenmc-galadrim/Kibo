import { z } from "zod";

export const BackupReason = z.enum(["auto", "manual", "update"]);
export type BackupReason = z.infer<typeof BackupReason>;
export const BackupId = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
export type BackupId = z.infer<typeof BackupId>;
export const BackupInfo = z.object({
  id: BackupId,
  createdAt: z.number(),
  reason: BackupReason,
  bytes: z.number().int().nonnegative(),
  appVersion: z.string(),
});
export type BackupInfo = z.infer<typeof BackupInfo>;
export const BackupSettings = z.object({ enabled: z.boolean(), dir: z.string().min(1).nullable() });
export type BackupSettings = z.infer<typeof BackupSettings>;
export const BACKUP_SETTINGS_DEFAULT: BackupSettings = { enabled: true, dir: null };
export type BackupStatus = {
  settings: BackupSettings;
  dir: string;
  displayDir: string;
  last: BackupInfo | null;
  nextAt: number | null;
  running: boolean;
};
export const BACKUP_KEEP = 7;
export const BACKUP_EVERY_MS = 86_400_000;
export const BACKUP_TICK_MS = 3_600_000;
