import { type CiRun, KiboError, type ProjectEvent, type ProjectSnapshot } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

export const JOURNAL_LIMIT = 50;

const quiet = (what: string) => (e: unknown) => {
  if (!(e instanceof KiboError && e.code === "NOT_CONNECTED")) console.warn(`[kibo] ${what} unavailable`, e);
};

export type TicketJournal = { events: ProjectEvent[]; error: boolean };

export function useTicketJournal(project: ProjectSnapshot, ticketId: string): TicketJournal {
  const [journal, setJournal] = useState<TicketJournal>({ events: [], error: false });
  useEffect(() => {
    let alive = true;
    client
      .rpc({ method: "listProjectEvents", projectId: project.meta.id, ticketId, limit: JOURNAL_LIMIT })
      .then(
        (page) => alive && setJournal({ events: page?.items ?? [], error: false }),
        (e: unknown) => {
          quiet("ticket journal")(e);
          if (alive) setJournal((prev) => ({ ...prev, error: true }));
        },
      );
    return () => {
      alive = false;
    };
  }, [project, ticketId]);
  return journal;
}

export function useTicketCiRuns(projectId: string, ticketId: string): CiRun[] {
  const [runs, setRuns] = useState<CiRun[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      client
        .rpc({ method: "listCiRuns", projectId, ticketId })
        .then((next) => alive && setRuns(next ?? []), quiet("CI runs"));
    void load();
    const off = client.subscribeIntegrations((e) => {
      if (e.type === "ci" && e.projectId === projectId) void load();
    });
    return () => {
      alive = false;
      off();
    };
  }, [projectId, ticketId]);
  return runs;
}
