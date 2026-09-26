import type { FileRef } from "@kibo/schema";
import { useCallback } from "react";
import { client } from "../api";
import { errorMessage } from "../lib/error-message";

export function useExternalOpen(
  fileRef: FileRef,
  worktree: string | null,
  onError: (message: string) => void,
) {
  const { projectId, path, line } = fileRef;
  return useCallback(() => {
    if (!worktree) return;
    client
      .code({ method: "openInEditor", projectId, worktree, path, line })
      .catch((e: unknown) => onError(errorMessage(e)));
  }, [projectId, path, line, worktree, onError]);
}
