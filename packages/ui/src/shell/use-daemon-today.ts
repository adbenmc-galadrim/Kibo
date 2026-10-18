import { useEffect, useState } from "react";
import { client } from "../api";
import { localDay } from "./sprint/sprint-facts";

const REFRESH_MS = 60_000;

function useDaemonDay(enabled: boolean): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      client
        .rpc({ method: "getAppInfo" })
        .then((info) => alive && setToday(info?.today ?? null), console.error);
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled]);
  return today;
}

export function useDaemonToday(now?: number): string | null {
  const daemonDay = useDaemonDay(now === undefined);
  return now === undefined ? daemonDay : localDay(now);
}
