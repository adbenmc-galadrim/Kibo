import type { RunState } from "@kibo/schema";
import { AgentMention } from "@kibo/sdk";
import { frMoments } from "../../i18n/fr-moments";
import { useRunPeek } from "./use-run-peek";

type Props = { runId: string; label: string; state?: RunState; className?: string };

export function Mention({ runId, label, state, className }: Props) {
  const handlers = useRunPeek();
  return (
    <AgentMention
      runId={runId}
      label={label}
      state={state}
      className={className}
      texts={frMoments.mention}
      peek={handlers.peek}
      onOpen={handlers.onOpen}
      onReply={handlers.onReply}
    />
  );
}
