import type { MarketComponentStatus } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export function useMarketStatus(): { statuses: MarketComponentStatus[]; reload(): void } {
  const [statuses, setStatuses] = useState<MarketComponentStatus[]>([]);
  const reload = useCallback(() => {
    client
      .rpc({ method: "listMarketStatus" })
      .then(setStatuses)
      .catch((e: unknown) => console.error("[kibo-ui] market status failed", e));
  }, []);
  useEffect(() => {
    reload();
    return client.subscribe((projectId) => {
      if (projectId === null) reload();
    });
  }, [reload]);
  return { statuses, reload };
}
