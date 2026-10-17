import { useEffect, useState } from "react";
import { client } from "../api";

export function usePendingCount(projectId: string, batchId: string | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (batchId === null) return;
    let alive = true;
    client
      .rpc({ method: "getProjectAgent", projectId })
      .then((view) => {
        if (alive) setCount(view.batches.find((b) => b.id === batchId)?.actions.length ?? 0);
      })
      .catch((e: unknown) => console.error(e));
    return () => {
      alive = false;
    };
  }, [projectId, batchId]);
  return count;
}
