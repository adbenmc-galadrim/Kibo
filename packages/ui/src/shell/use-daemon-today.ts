import { useEffect, useState } from "react";
import { client } from "../api";
import { useNow } from "../state/use-agents";
import { localDay } from "./sprint/sprint-facts";

type DaemonClock = { fixed: number | null } | null;

const fixedAt = (fixedNow: string | null | undefined): number | null => {
  const at = fixedNow ? Date.parse(fixedNow) : Number.NaN;
  return Number.isNaN(at) ? null : at;
};

function useDaemonClock(enabled: boolean): DaemonClock {
  const [clock, setClock] = useState<DaemonClock>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    client.rpc({ method: "getAppInfo" }).then(
      (info) => alive && setClock({ fixed: fixedAt(info?.fixedNow) }),
      () => alive && setClock({ fixed: null }),
    );
    return () => {
      alive = false;
    };
  }, [enabled]);
  return clock;
}

export function useDaemonToday(now: number | undefined): string | null {
  const liveNow = useNow(60_000);
  const clock = useDaemonClock(now === undefined);
  if (now !== undefined) return localDay(now);
  return clock === null ? null : localDay(clock.fixed ?? liveNow);
}
