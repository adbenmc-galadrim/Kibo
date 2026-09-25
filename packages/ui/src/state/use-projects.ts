import { KiboError, type ProjectMeta, type ProjectSnapshot } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

function unlessUnauthorized(e: unknown): void {
  if (!(e instanceof KiboError && e.code === "UNAUTHORIZED")) throw e;
}

export function useProjects(): ProjectMeta[] | null {
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  useEffect(() => {
    const load = () => client.rpc({ method: "listProjects" }).then(setProjects, unlessUnauthorized);
    void load();
    return client.subscribe((id) => {
      if (id === null) void load();
    });
  }, []);
  return projects;
}

export function useProject(projectId: string | null): ProjectSnapshot | null {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  useEffect(() => {
    setSnapshot(null);
    if (!projectId) return;
    let current = true;
    const load = () =>
      client
        .rpc({ method: "getProject", projectId })
        .then((s) => current && setSnapshot(s), unlessUnauthorized);
    void load();
    const unsubscribe = client.subscribe((id) => {
      if (id === projectId) void load();
    });
    return () => {
      current = false;
      unsubscribe();
    };
  }, [projectId]);
  return snapshot?.meta.id === projectId ? snapshot : null;
}
