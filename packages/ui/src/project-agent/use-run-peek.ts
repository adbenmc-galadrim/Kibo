import type { RunPeek } from "@kibo/schema";
import { client } from "../api";
import { useOptionalHost } from "../shell/Host";

export const peekRun = (runId: string): Promise<RunPeek> => client.rpc({ method: "runPeek", runId });

export type MentionHandlers = {
  peek(runId: string): Promise<RunPeek>;
  onOpen(runId: string): void;
  onReply?(runId: string): void;
};

export function useRunPeek(): MentionHandlers {
  const host = useOptionalHost();
  return {
    peek: peekRun,
    onOpen: (runId) => host?.openRun?.(runId),
    onReply: host?.answerRun,
  };
}
