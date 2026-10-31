import { KiboError, type ProjectSnapshot, type ProjectSummary } from "@kibo/schema";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { client } from "../api";
import { projectStore } from "./project-store";

const isUnauthorized = (e: unknown) => e instanceof KiboError && e.code === "UNAUTHORIZED";

function unlessUnauthorized(e: unknown): void {
  if (!isUnauthorized(e)) throw e;
}

type ProjectsState = { projects: ProjectSummary[] | null; error: unknown; retry(): void };

export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const reload = useRef(() => {});
  useEffect(() => {
    let current = true;
    const load = () =>
      client.rpc({ method: "listProjects" }).then(
        (list) => {
          if (!current) return;
          setProjects(list);
          setError(null);
        },
        (e: unknown) => {
          if (current && !isUnauthorized(e)) setError(e);
        },
      );
    reload.current = () => void load();
    void load();
    const unsubscribe = client.subscribe((id) => {
      if (id === null) void load();
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, []);
  const retry = useCallback(() => reload.current(), []);
  return { projects, error, retry };
}

export function useProject(projectId: string | null): ProjectSnapshot | null {
  const snapshot = useSyncExternalStore(projectStore.subscribe, () =>
    projectId ? projectStore.peek(projectId) : null,
  );
  useEffect(() => {
    if (!projectId) return;
    const release = projectStore.watch(projectId);
    projectStore.ensure(projectId).catch(unlessUnauthorized);
    return release;
  }, [projectId]);
  return snapshot;
}
