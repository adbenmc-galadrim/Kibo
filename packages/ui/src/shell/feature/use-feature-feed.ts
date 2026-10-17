import { type CiRun, KiboError, type ProjectEvent, type ProjectSnapshot } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../../api";
import { ACTIVITY_MAX } from "./feature-feed";

const warn = (what: string) => (e: unknown) => console.warn(`[kibo] ${what} unavailable`, e);

export function useFeatureJournal(project: ProjectSnapshot, featureId: string): ProjectEvent[] {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  useEffect(() => {
    if (!project.tickets.some((t) => t.id === featureId)) return;
    let alive = true;
    client
      .rpc({ method: "listProjectEvents", projectId: project.meta.id, featureId, limit: ACTIVITY_MAX })
      .then((page) => alive && setEvents(page.items), warn("project journal"));
    return () => {
      alive = false;
    };
  }, [project, featureId]);
  return events;
}

export function useProjectCiRuns(projectId: string): CiRun[] {
  const [runs, setRuns] = useState<CiRun[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      client.rpc({ method: "listCiRuns", projectId, ticketId: null }).then(
        (next) => alive && setRuns(next),
        (e: unknown) => {
          if (!(e instanceof KiboError && e.code === "NOT_CONNECTED")) warn("CI runs")(e);
        },
      );
    void load();
    const off = client.subscribeIntegrations((e) => {
      if (e.type === "ci" && e.projectId === projectId) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId]);
  return runs;
}
