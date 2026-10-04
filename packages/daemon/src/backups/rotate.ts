import { BACKUP_KEEP, type BackupInfo } from "@kibo/schema";

export function toRotate(backups: BackupInfo[], keep: number = BACKUP_KEEP): BackupInfo[] {
  const automatic = backups.filter((b) => b.reason === "auto").sort((a, b) => a.createdAt - b.createdAt);
  return automatic.slice(0, Math.max(0, automatic.length - keep));
}
