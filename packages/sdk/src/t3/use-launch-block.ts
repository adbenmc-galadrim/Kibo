import { useWriteBlock } from "../react";
import { frT3 } from "./fr-t3";
import { useT3 } from "./t3-context";
import { useT3Status } from "./use-t3-status";

export function useLaunchBlock(projectId: string, folderMissing: boolean): string | null {
  const { api } = useT3(projectId);
  const status = useT3Status(api.status);
  const writeBlock = useWriteBlock();
  if (writeBlock !== null) return writeBlock;
  if (folderMissing) return frT3.noFolder;
  if (status && !status.available) return status.reason === "missing" ? frT3.missing : frT3.serverDown;
  return null;
}
