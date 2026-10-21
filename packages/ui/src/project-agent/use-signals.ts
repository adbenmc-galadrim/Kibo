import { KiboError, type SignalsView } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type SignalsState = { view: SignalsView | null; error: KiboError | null; reload(): void };

const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", e instanceof Error ? e.message : String(e));

export function useSignals(projectId: string | null): SignalsState {
  const [view, setView] = useState<SignalsView | null>(null);
  const [error, setError] = useState<KiboError | null>(null);
  const load = useRef<() => void>(() => {});
  useEffect(() => {
    setView(null);
    setError(null);
    if (!projectId) return;
    let alive = true;
    load.current = () => {
      client.rpc({ method: "listSignals", projectId }).then(
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
  }, [projectId]);
  const reload = useCallback(() => load.current(), []);
  return { view, error, reload };
}
