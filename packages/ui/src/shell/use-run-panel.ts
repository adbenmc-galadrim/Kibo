import { useCallback, useEffect, useState } from "react";

export type RunPanelState = { runId: string | null; open(runId: string): void; close(): void };
type AgentPanel = { open: boolean; close(): void };
type Shown = { runId: string; projectId: string | null };

export function useRunPanel(projectId: string | null, agentPanel: AgentPanel): RunPanelState {
  const [shown, setShown] = useState<Shown | null>(null);
  const closeAgent = agentPanel.close;
  useEffect(() => {
    if (agentPanel.open) setShown(null);
  }, [agentPanel.open]);
  const open = useCallback(
    (runId: string) => {
      closeAgent();
      setShown({ runId, projectId });
    },
    [closeAgent, projectId],
  );
  const close = useCallback(() => setShown(null), []);
  if (shown && shown.projectId !== projectId) setShown(null);
  return { runId: shown?.projectId === projectId ? shown.runId : null, open, close };
}
