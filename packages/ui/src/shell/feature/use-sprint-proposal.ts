import { useState } from "react";
import { client } from "../../api";
import { failureText } from "../../lib/remote-error";
import { useProjectAgent } from "../../project-agent/use-project-agent";
import { type SprintProposal, sprintApplyRequest, sprintProposal } from "./sprint-proposal";

type SprintProposalState = { proposal: SprintProposal | null; apply(): void; error: string | null };

export function useSprintProposal(projectId: string, featureKey: string | null): SprintProposalState {
  const { view, reload } = useProjectAgent(projectId);
  const [error, setError] = useState<string | null>(null);
  const proposal = sprintProposal(view?.batches ?? [], featureKey);
  const apply = () => {
    if (!proposal) return;
    setError(null);
    client
      .rpc(sprintApplyRequest(projectId, proposal))
      .then(reload, (e: unknown) => setError(failureText(e)));
  };
  return { proposal, apply, error };
}
