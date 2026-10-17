import { undecidedActionIds } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export function usePendingCount(projectId: string, batchId: string | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (batchId === null) return;
    let alive = true;
    const load = () =>
      client
        .rpc({ method: "getProjectAgent", projectId })
        .then((view) => {
          const batch = view.batches.find((b) => b.id === batchId);
          if (alive) setCount(batch ? undecidedActionIds(batch).length : 0);
        })
        .catch((e: unknown) => console.error(e));
    void load();
    const off = client.subscribeTopic("agents", () => void load());
    return () => {
      alive = false;
      off();
    };
  }, [projectId, batchId]);
  return count;
}
