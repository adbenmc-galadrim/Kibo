import type { RunEvent, RunLogEntry } from "@kibo/schema";
import { RUN_TEXT } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { fr } from "../i18n/fr";
import { errorText, formatClock } from "./format";

type Tone = "blue" | "amber" | "green" | "red" | "muted";
export type JournalLine = { name: string; text: string; tone: Tone };

const TONE: Record<Tone, string> = {
  blue: RUN_TEXT.running,
  amber: RUN_TEXT.waiting_input,
  green: RUN_TEXT.done,
  red: RUN_TEXT.failed,
  muted: RUN_TEXT.cancelled,
};

export function journalLine(event: RunEvent): JournalLine | null {
  const e = fr.agents.events;
  switch (event.type) {
    case "enqueued":
      return { name: e.enqueued, text: "", tone: "muted" };
    case "admitted":
      return { name: e.admitted, text: String(event.lane), tone: "muted" };
    case "spawned":
      return { name: e.spawned, text: event.resume ? e.resumed : e.loaded(event.guidelines), tone: "blue" };
    case "hook": {
      const p = event.payload;
      if (p.question) return { name: e.question, text: p.question, tone: "amber" };
      if (p.event === "PreToolUse") return null;
      return { name: p.event, text: [p.tool, p.detail].filter(Boolean).join(" "), tone: "blue" };
    }
    case "exited":
      return {
        name: e.exited,
        text: event.denied.length > 0 ? e.denied(event.denied.join(", ")) : (event.result ?? ""),
        tone: event.isError ? "red" : "green",
      };
    case "answered":
      return { name: e.answered, text: event.text, tone: "muted" };
    case "cancelled":
      return { name: e.cancelled, text: "", tone: "muted" };
    case "failed":
      return { name: e.failed, text: errorText(event.error), tone: "red" };
    case "prioritized":
      return event.priority ? { name: e.prioritized, text: "", tone: "muted" } : null;
    case "reranked":
      return null;
  }
}

export function RunJournal({ label, log }: { label: string; log: RunLogEntry[] }) {
  const lines = log.flatMap((entry) => {
    const line = journalLine(entry.event);
    return line ? [{ ...line, id: entry.id, at: entry.at }] : [];
  });
  return (
    <ol
      aria-label={fr.agents.journal(label)}
      className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto rounded-md border p-3 text-xs"
    >
      {lines.map((l) => (
        <li key={l.id} data-tone={l.tone} className="grid grid-cols-[3rem_8rem_1fr] gap-2">
          <span className="font-mono text-muted-foreground">{formatClock(l.at)}</span>
          <span className={cn("truncate font-mono", TONE[l.tone])}>{l.name}</span>
          <span className="line-clamp-3 break-words">{l.text}</span>
        </li>
      ))}
    </ol>
  );
}
