import {
  holdSuggestions,
  KiboError,
  PROJECT_EVENTS_PAGE_MAX,
  type ProjectEvent,
  type ProjectSnapshot,
} from "@kibo/schema";
import { useEffect, useState } from "react";
import { client } from "../api";

const currentReasons = (snapshot: ProjectSnapshot | null): (string | null)[] =>
  (snapshot?.tickets ?? []).map((t) => (t.onHold?.source === "own" ? t.onHold.reason : null));

const journalReasons = (events: readonly ProjectEvent[]): string[] =>
  events.flatMap((ev) => {
    const reason = ev.kind === "held" ? ev.data.reason : undefined;
    return typeof reason === "string" && reason !== "" ? [reason] : [];
  });

const quiet = (e: unknown) => {
  if (!(e instanceof KiboError && e.code === "NOT_CONNECTED"))
    console.warn("[kibo] hold reasons unavailable", e);
};

export function useHoldSuggestions(projectId: string): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      client.rpc({ method: "getProject", projectId }),
      client.rpc({ method: "listProjectEvents", projectId, limit: PROJECT_EVENTS_PAGE_MAX }),
    ]).then(([snapshot, page]) => {
      if (alive) setSuggestions(holdSuggestions(currentReasons(snapshot), journalReasons(page?.items ?? [])));
    }, quiet);
    return () => {
      alive = false;
    };
  }, [projectId]);
  return suggestions;
}
