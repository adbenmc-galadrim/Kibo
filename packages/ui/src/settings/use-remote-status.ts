import type { RemoteStatus } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

const POLL_MS = 5000;
const TICK_MS = 1000;

export const describeError = (e: unknown): string => (e instanceof Error ? e.message : String(e));

type RemoteStatusState = {
  status: RemoteStatus | null;
  error: string | null;
  now: number;
  apply(status: RemoteStatus): void;
};

export function useRemoteStatus(): RemoteStatusState {
  const [status, setStatus] = useState<RemoteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let live = true;
    const load = () =>
      client.rpc({ method: "remote.status" }).then(
        (next) => {
          if (!live) return;
          setStatus(next);
          setError(null);
        },
        (e: unknown) => {
          if (live) setError(describeError(e));
        },
      );
    void load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);
  const apply = useCallback((next: RemoteStatus) => {
    setStatus(next);
    setError(null);
    setNow(Date.now());
  }, []);
  return { status, error, now, apply };
}
