import type { Role, StarterPlan } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type SuggestionState =
  | { status: "idle" }
  | { status: "waiting"; runId: string | null; queued: boolean }
  | { status: "ready"; plan: StarterPlan }
  | { status: "unavailable" };

const abandon = (runId: string) => {
  client.rpc({ method: "cancelRun", runId }).catch((e: unknown) => console.error(e));
};

export function useStarterSuggestion(): {
  state: SuggestionState;
  suggest: (role: Role, text: string) => void;
  cancel: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<SuggestionState>({ status: "idle" });
  const request = useRef(0);
  const inFlight = useRef(false);
  const runRef = useRef<string | null>(null);
  const early = useRef(new Map<string, StarterPlan | null>());
  const stop = useCallback(() => {
    const runId = runRef.current;
    request.current++;
    inFlight.current = false;
    runRef.current = null;
    early.current.clear();
    if (runId) abandon(runId);
  }, []);
  const finish = useCallback((plan: StarterPlan | null) => {
    request.current++;
    inFlight.current = false;
    runRef.current = null;
    early.current.clear();
    setState(plan ? { status: "ready", plan } : { status: "unavailable" });
  }, []);
  useEffect(() => {
    const offAi = client.subscribeAi((e) => {
      if (e.type !== "starter.ready") return;
      if (e.runId === runRef.current) finish(e.plan);
      else if (inFlight.current) early.current.set(e.runId, e.plan);
    });
    const offRuns = client.onRunChanged((e) => {
      if (e.runId === runRef.current)
        setState((s) => (s.status === "waiting" ? { ...s, queued: e.state === "queued" } : s));
    });
    const offConnection = client.onConnection(() => {
      if (!client.online() && (runRef.current !== null || inFlight.current)) finish(null);
    });
    return () => {
      offAi();
      offRuns();
      offConnection();
      stop();
    };
  }, [finish, stop]);
  const suggest = useCallback(
    (role: Role, text: string) => {
      stop();
      const id = request.current;
      inFlight.current = true;
      setState({ status: "waiting", runId: null, queued: false });
      client.rpc({ method: "suggestStarter", role, text }).then(
        ({ runId }) => {
          if (id !== request.current) return abandon(runId);
          inFlight.current = false;
          if (early.current.has(runId)) return finish(early.current.get(runId) ?? null);
          runRef.current = runId;
          setState({ status: "waiting", runId, queued: false });
        },
        () => {
          if (id === request.current) finish(null);
        },
      );
    },
    [finish, stop],
  );
  const cancel = useCallback(() => {
    stop();
    setState({ status: "unavailable" });
  }, [stop]);
  const reset = useCallback(() => {
    stop();
    setState({ status: "idle" });
  }, [stop]);
  return { state, suggest, cancel, reset };
}
