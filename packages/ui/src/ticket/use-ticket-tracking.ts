import { type CiRun, KiboError, type ProjectEvent, type TicketView } from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

const JOURNAL_LIMIT = 50;

const quiet = (what: string) => (e: unknown) => {
  if (!(e instanceof KiboError && e.code === "NOT_CONNECTED")) console.warn(`[kibo] ${what} unavailable`, e);
};

export type TicketJournal = { events: ProjectEvent[]; error: boolean };

type JournalFacts = Pick<
  TicketView,
  "id" | "statusId" | "delivery" | "session" | "externalRefs" | "sprintId" | "hold"
>;

export const journalSignal = (ticket: JournalFacts): string =>
  JSON.stringify([
    ticket.statusId,
    ticket.delivery,
    ticket.session,
    ticket.externalRefs,
    ticket.sprintId,
    ticket.hold,
  ]);

export function useTicketJournal(projectId: string, ticket: JournalFacts): TicketJournal {
  const [journal, setJournal] = useState<TicketJournal & { signal: string | null }>({
    events: [],
    error: false,
    signal: null,
  });
  const ticketId = ticket.id;
  const signal = journalSignal(ticket);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "listProjectEvents", projectId, ticketId, limit: JOURNAL_LIMIT }).then(
      (page) => alive && setJournal({ events: page?.items ?? [], error: false, signal }),
      (e: unknown) => {
        quiet("ticket journal")(e);
        if (alive) setJournal((prev) => ({ ...prev, error: true, signal }));
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId, ticketId, signal]);
  return { events: journal.events, error: journal.error };
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
