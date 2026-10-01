import { type AgentsState, KiboError, type RunLogEntry, type WorkspaceConfig } from "@kibo/schema";
import { useEffect, useState, useSyncExternalStore } from "react";
import { client } from "../api";

function unlessUnauthorized(e: unknown): void {
  if (!(e instanceof KiboError && e.code === "UNAUTHORIZED")) throw e;
}

export function useAgents(): AgentsState | null {
  const [state, setState] = useState<AgentsState | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      client.rpc({ method: "getAgents" }).then((s) => alive && setState(s), unlessUnauthorized);
    void load();
    const off = client.subscribeTopic("agents", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export function useConfig(): WorkspaceConfig | null {
  const [config, setConfig] = useState<WorkspaceConfig | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      client.rpc({ method: "getConfig" }).then((c) => alive && setConfig(c), unlessUnauthorized);
    void load();
    const off = client.subscribeTopic("config", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return config;
}

export type RunLog = { log: RunLogEntry[] | null; missing: boolean };

const NO_LOG: RunLog = { log: null, missing: false };

function missingUnlessOther(e: unknown): RunLog {
  if (e instanceof KiboError && e.code === "NOT_FOUND") return { log: null, missing: true };
  unlessUnauthorized(e);
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
        .then((log) => ({ log, missing: log.length === 0 }), missingUnlessOther)
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

export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDaemonOnline(): boolean {
  return useSyncExternalStore(client.onConnection, client.online);
}
