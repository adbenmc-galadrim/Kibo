import { KiboError, type ProjectSnapshot } from "@kibo/schema";
import { useEffect, useMemo, useState } from "react";
import { client } from "../api";

export function useSnapshots(projectIds: string[]): Map<string, ProjectSnapshot> {
  const key = useMemo(() => [...new Set(projectIds)].sort().join("\n"), [projectIds]);
  const [snapshots, setSnapshots] = useState<Map<string, ProjectSnapshot>>(new Map());
  useEffect(() => {
    const ids = key ? key.split("\n") : [];
    let alive = true;
    const load = (id: string) =>
      client.rpc({ method: "getProject", projectId: id }).then(
        (s) => alive && setSnapshots((prev) => new Map(prev).set(id, s)),
        (e: unknown) => {
          if (e instanceof KiboError && (e.code === "NOT_FOUND" || e.code === "UNAUTHORIZED")) {
            if (alive)
              setSnapshots((prev) => {
                const next = new Map(prev);
                next.delete(id);
                return next;
              });
            return;
          }
          throw e;
        },
      );
    for (const id of ids) void load(id);
    const off = client.subscribe((changed) => {
      if (changed !== null && ids.includes(changed)) void load(changed);
    });
    return () => {
      alive = false;
      off();
    };
  }, [key]);
  return snapshots;
}
