import type { KiboError, ParallelWork } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";
import { asKiboError } from "./use-overlaps";

export type ParallelWorkState = { work: ParallelWork | null; error: KiboError | null };

export function useParallelWork(runId: string): ParallelWorkState {
  const [state, setState] = useState<ParallelWorkState>({ work: null, error: null });
  useEffect(() => {
    setState({ work: null, error: null });
    let alive = true;
    const load = () =>
      client.rpc({ method: "overlaps.parallel", runId }).then(
        (work) => {
          if (alive) setState({ work, error: null });
        },
        (e: unknown) => {
          if (alive) setState((s) => ({ ...s, error: asKiboError(e) }));
        },
      );
    void load();
    const off = client.subscribeTopic("agents", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [runId]);
  return state;
}
