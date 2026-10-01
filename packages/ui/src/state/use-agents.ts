import { type AgentsState, KiboError, type WorkspaceConfig } from "@kibo/schema";
import { useEffect, useState, useSyncExternalStore } from "react";
import { client } from "../api";
import { useRunLog as runLogOf } from "./use-run-log";

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

export type { RunLog } from "./use-run-log";
export const useRunLog = runLogOf;

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
