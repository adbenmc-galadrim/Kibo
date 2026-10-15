import type { RunMoment } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";
import { mergeMoments } from "./use-run-moments";

export type SubagentMomentsState = { moments: RunMoment[]; loading: boolean; failed: boolean };

const ownedBy = (moments: readonly RunMoment[], subagentId: string): RunMoment[] =>
  moments.filter((m) => m.subagentId === subagentId);

export function useSubagentMoments(runId: string, subagentId: string): SubagentMomentsState {
  const [state, setState] = useState<SubagentMomentsState>({ moments: [], loading: true, failed: false });
  useEffect(() => {
    let alive = true;
    setState({ moments: [], loading: true, failed: false });
    const off = client.subscribeMoments((event) => {
      if (event.runId !== runId) return;
      const mine = ownedBy(event.moments, subagentId);
      if (mine.length > 0) setState((s) => ({ ...s, moments: mergeMoments(s.moments, mine) }));
    });
    client.rpc({ method: "runs.subagentMoments", runId, subagentId }).then(
      (page) => {
        if (alive)
          setState((s) => ({
            moments: mergeMoments(s.moments, ownedBy(page.moments, subagentId)),
            loading: false,
            failed: false,
          }));
      },
      () => {
        if (alive) setState((s) => ({ ...s, loading: false, failed: true }));
      },
    );
    return () => {
      alive = false;
      off();
    };
  }, [runId, subagentId]);
  return state;
}
