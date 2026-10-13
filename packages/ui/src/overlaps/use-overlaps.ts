import { KiboError, type Overlap, type OverlapStatus } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";

export type OverlapQuery = { projectId?: string; runId?: string; state?: OverlapStatus };

export type OverlapsState = {
  overlaps: Overlap[];
  error: KiboError | null;
  reload(): void;
  ignore(id: string): Promise<void>;
};

export const asKiboError = (e: unknown): KiboError =>
  e instanceof KiboError ? e : new KiboError("INTERNAL", e instanceof Error ? e.message : String(e));

const keyOf = (q: OverlapQuery | null): string | null =>
  q === null ? null : JSON.stringify([q.projectId ?? null, q.runId ?? null, q.state ?? null]);

export function useOverlaps(query: OverlapQuery | null): OverlapsState {
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [error, setError] = useState<KiboError | null>(null);
  const load = useRef<() => Promise<void>>(() => Promise.resolve());
  const key = keyOf(query);
  const latest = useRef(query);
  latest.current = query;
  useEffect(() => {
    setOverlaps([]);
    setError(null);
    const q = latest.current;
    if (key === null || q === null) return;
    let alive = true;
    load.current = () =>
      client.rpc({ method: "overlaps.list", ...q }).then(
        (next) => {
          if (!alive) return;
          setOverlaps(next);
          setError(null);
        },
        (e: unknown) => {
          if (alive) setError(asKiboError(e));
        },
      );
    void load.current();
    const off = client.subscribeTopic("agents", () => void load.current());
    return () => {
      alive = false;
      load.current = () => Promise.resolve();
      off();
    };
  }, [key]);
  const reload = useCallback(() => void load.current(), []);
  const ignore = useCallback(async (id: string) => {
    await client.rpc({ method: "overlaps.ignore", id });
    await load.current();
  }, []);
  return { overlaps, error, reload, ignore };
}

export function useRunsOverlaps(runIds: readonly string[]): { overlaps: Overlap[]; error: KiboError | null } {
  const key = runIds.join("\n");
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [failed, setFailed] = useState<KiboError | null>(null);
  useEffect(() => {
    setOverlaps([]);
    setFailed(null);
    const ids = key === "" ? [] : key.split("\n");
    if (ids.length === 0) return;
    let alive = true;
    const load = () =>
      Promise.all(ids.map((runId) => client.rpc({ method: "overlaps.list", runId }))).then(
        (lists) => {
          if (!alive) return;
          const byId = new Map(lists.flat().map((o) => [o.id, o]));
          setOverlaps([...byId.values()]);
        },
        (e: unknown) => {
          if (alive) setFailed(asKiboError(e));
        },
      );
    void load();
    const off = client.subscribeTopic("agents", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [key]);
  return { overlaps, error: failed };
}
