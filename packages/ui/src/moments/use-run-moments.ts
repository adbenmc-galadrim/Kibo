import { KiboError, type RunMoment, type RunMomentsPage } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export type RunMomentsState = { page: RunMomentsPage | null; loading: boolean; error: KiboError | null };

const IDLE: RunMomentsState = { page: null, loading: false, error: null };

const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", String(e));

export function mergeMoments(current: readonly RunMoment[], incoming: readonly RunMoment[]): RunMoment[] {
  const bySeq = new Map(current.map((m) => [m.seq, m]));
  for (const m of incoming) if (!bySeq.has(m.seq)) bySeq.set(m.seq, m);
  return [...bySeq.values()].sort((a, b) => a.at - b.at || a.seq - b.seq);
}

export function useRunMoments(runId: string | null): RunMomentsState {
  const [state, setState] = useState<RunMomentsState>(IDLE);
  useEffect(() => {
    if (!runId) {
      setState(IDLE);
      return;
    }
    let alive = true;
    let pending: RunMoment[] = [];
    setState({ page: null, loading: true, error: null });
    const off = client.subscribeMoments((event) => {
      if (event.runId !== runId) return;
      setState((s) => {
        if (!s.page) {
          pending = mergeMoments(pending, event.moments);
          return s;
        }
        return { ...s, page: { ...s.page, moments: mergeMoments(s.page.moments, event.moments) } };
      });
    });
    client.rpc({ method: "runMoments", runId }).then(
      (page) => {
        if (!alive) return;
        const loaded = page ? { ...page, moments: mergeMoments(page.moments, pending) } : null;
        setState({ page: loaded, loading: false, error: null });
      },
      (e: unknown) => {
        if (alive) setState({ page: null, loading: false, error: asKiboError(e) });
      },
    );
    return () => {
      alive = false;
      off();
    };
  }, [runId]);
  return state;
}
