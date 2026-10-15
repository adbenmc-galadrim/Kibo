import { type RunMoment, type RunSubagent, runSubagents } from "@kibo/schema";
import { useEffect, useMemo, useState } from "react";
import { client } from "../api";
import { useAgentsState } from "../state/agents-context";

export type RunSubagents = {
  list: RunSubagent[];
  byId: ReadonlyMap<string, RunSubagent>;
  failed: boolean;
};

const announced = (moments: readonly RunMoment[]): number =>
  moments.filter((m) => m.data.kind === "subagent").length;

function useActiveKey(runId: string | null): string {
  const agents = useAgentsState();
  if (!agents || runId === null) return "";
  return runSubagents(agents)
    .filter((s) => s.runId === runId)
    .map((s) => `${s.id}:${s.state}`)
    .sort()
    .join(",");
}

export function useRunSubagents(runId: string | null, moments: readonly RunMoment[]): RunSubagents {
  const [state, setState] = useState<{ list: RunSubagent[]; failed: boolean }>({ list: [], failed: false });
  const count = announced(moments);
  const active = useActiveKey(runId);
  useEffect(() => {
    if (runId === null || (count === 0 && active === "")) {
      setState({ list: [], failed: false });
      return;
    }
    let alive = true;
    client.rpc({ method: "runs.subagents", runId }).then(
      (list) => {
        if (alive) setState({ list, failed: false });
      },
      () => {
        if (alive) setState((s) => ({ ...s, failed: true }));
      },
    );
    return () => {
      alive = false;
    };
  }, [runId, count, active]);
  const byId = useMemo(() => new Map(state.list.map((s) => [s.id, s])), [state.list]);
  return { list: state.list, byId, failed: state.failed };
}
