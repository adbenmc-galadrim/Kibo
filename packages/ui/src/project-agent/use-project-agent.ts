import { KiboError, type ProjectAgentView } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type ProjectAgentState = { view: ProjectAgentView | null; error: KiboError | null; reload(): void };

const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", e instanceof Error ? e.message : String(e));

export function useProjectAgent(projectId: string | null, runId?: string): ProjectAgentState {
  const [view, setView] = useState<ProjectAgentView | null>(null);
  const [error, setError] = useState<KiboError | null>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    setView(null);
    setError(null);
    if (!projectId) return;
    let alive = true;
    const req = { method: "getProjectAgent" as const, projectId, ...(runId ? { runId } : {}) };
    load.current = () => {
      client.rpc(req).then(
        (next) => {
          if (!alive) return;
          setView(next);
          setError(null);
        },
        (e: unknown) => alive && setError(asKiboError(e)),
      );
    };
    load.current();
    const off = client.subscribeTopic("agents", () => load.current());
    return () => {
      alive = false;
      off();
    };
  }, [projectId, runId]);
  const reload = useCallback(() => load.current(), []);
  return { view, error, reload };
}
