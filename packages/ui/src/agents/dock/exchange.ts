import type { RunLogEntry } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import type { FeedExtra } from "../../moments/Feed";
import type { JournalRun } from "../journal-runs";
import { journalLines } from "../RunJournal";

const KIND: Record<string, FeedExtra["kind"]> = {
  Notification: "question",
  answered: "human",
  session: "system",
};

export function exchangeOf(log: RunLogEntry[] | null, runs: readonly JournalRun[]): FeedExtra[] {
  if (!log) return [];
  return journalLines(log, runs).flatMap((line) => {
    const resumed = line.name === "SessionStart" && line.text === fr.agents.events.resumed;
    const kind = resumed ? "system" : KIND[line.name];
    return kind ? [{ key: `${line.id}-${line.name}`, at: line.at, kind, text: line.text }] : [];
  });
}
