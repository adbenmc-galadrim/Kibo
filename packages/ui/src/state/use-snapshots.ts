import { KiboError, type ProjectSnapshot } from "@kibo/schema";
import { useEffect, useMemo, useState } from "react";
import { projectStore } from "./project-store";

function unlessGone(e: unknown): void {
  if (e instanceof KiboError && (e.code === "NOT_FOUND" || e.code === "UNAUTHORIZED")) return;
  throw e;
}

function readViews(ids: string[]): Map<string, ProjectSnapshot> {
  const views = new Map<string, ProjectSnapshot>();
  for (const id of ids) {
    const view = projectStore.peek(id);
    if (view) views.set(id, view);
  }
  return views;
}

export function useSnapshots(projectIds: string[]): Map<string, ProjectSnapshot> {
  const key = useMemo(() => [...new Set(projectIds)].sort().join("\n"), [projectIds]);
  const [snapshots, setSnapshots] = useState(() => readViews(key ? key.split("\n") : []));
  useEffect(() => {
    const ids = key ? key.split("\n") : [];
    const releases = ids.map((id) => projectStore.watch(id));
    const refresh = () => setSnapshots(readViews(ids));
    const off = projectStore.subscribe(refresh);
    refresh();
    for (const id of ids) projectStore.ensure(id).catch(unlessGone);
    return () => {
      off();
      for (const release of releases) release();
    };
  }, [key]);
  return snapshots;
}
