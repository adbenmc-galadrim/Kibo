import { type CiRun, KiboError } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

const quiet = (e: unknown) => {
  if (!(e instanceof KiboError && e.code === "NOT_CONNECTED")) console.warn("[kibo] CI runs unavailable", e);
};

export function useProjectCiRuns(projectIds: readonly string[]): ReadonlyMap<string, readonly CiRun[]> {
  const [runs, setRuns] = useState<ReadonlyMap<string, readonly CiRun[]>>(new Map());
  const ids = projectIds.join("\n");
  useEffect(() => {
    let alive = true;
    const wanted = ids === "" ? [] : ids.split("\n");
    const load = (projectId: string) =>
      client.rpc({ method: "listCiRuns", projectId, ticketId: null }).then((next) => {
        if (alive) setRuns((prev) => new Map(prev).set(projectId, next ?? []));
      }, quiet);
    for (const id of wanted) void load(id);
    const off = client.subscribeIntegrations((e) => {
      if (e.type === "ci" && wanted.includes(e.projectId)) void load(e.projectId);
    });
    return () => {
      alive = false;
      off();
    };
  }, [ids]);
  return runs;
}
