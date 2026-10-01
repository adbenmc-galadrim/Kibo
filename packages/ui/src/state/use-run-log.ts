import { KiboError, type RunLogEntry } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export type RunLog = { log: RunLogEntry[] | null; missing: boolean; empty: boolean };

const NO_LOG: RunLog = { log: null, missing: false, empty: false };

function missingUnlessOther(e: unknown): RunLog {
  if (e instanceof KiboError && e.code === "NOT_FOUND") return { log: null, missing: true, empty: false };
  if (!(e instanceof KiboError && e.code === "UNAUTHORIZED")) throw e;
  return NO_LOG;
}

export function useRunLog(runId: string | null): RunLog {
  const [state, setState] = useState<RunLog>(NO_LOG);
  useEffect(() => {
    setState(NO_LOG);
    if (!runId) return;
    let alive = true;
    const load = () =>
      client
        .rpc({ method: "getRunLog", runId })
        .then((log) => ({ log, missing: false, empty: log.length === 0 }), missingUnlessOther)
        .then((next) => alive && setState(next));
    void load();
    const off = client.subscribeTopic("agents", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [runId]);
  return state;
}
