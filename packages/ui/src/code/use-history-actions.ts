import type { CommitInfo } from "@kibo/schema";
import { client } from "../api";

type Target = { projectId: string; worktree: string };

export function useHistoryActions(w: Target, reload: () => void, onModify: (c: CommitInfo) => void) {
  return {
    onModify,
    onReword: async (c: CommitInfo, message: string) => {
      await client.code({ method: "reword", ...w, sha: c.sha, message });
      reload();
    },
    onUndo: async (c: CommitInfo) => {
      await client.code({ method: "undoCommit", ...w, sha: c.sha });
      reload();
    },
  };
}
