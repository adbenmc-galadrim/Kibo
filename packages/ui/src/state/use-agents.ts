import { type AgentsState, KiboError, type RunLogEntry, type WorkspaceConfig } from "@kibo/schema";
import { useEffect, useState } from "react";
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

export function useRunLog(runId: string | null): RunLogEntry[] | null {
  const [log, setLog] = useState<RunLogEntry[] | null>(null);
  useEffect(() => {
    setLog(null);
    if (!runId) return;
    let alive = true;
    const load = () =>
      client.rpc({ method: "getRunLog", runId }).then((l) => alive && setLog(l), unlessUnauthorized);
    void load();
    const off = client.subscribeTopic("agents", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [runId]);
  return log;
}

export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
