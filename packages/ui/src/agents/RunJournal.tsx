import type { HookEventName, HookPayload, RunEvent, RunLogEntry } from "@kibo/schema";
import { LinkifiedText, RUN_TEXT } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { fr } from "../i18n/fr";
import { frAgentsPage } from "../i18n/fr-agents-page";
import { errorText, formatClock } from "./format";

type Tone = "blue" | "amber" | "green" | "red" | "muted";
export type JournalLine = {
  id: number;
  at: number;
  name: string;
  tool: string | null;
  text: string;
  tone: Tone;
  whole: boolean;
};
export type JournalFiles = {
  worktree: string;
  ticketKey: string | null;
  open(path: string, line: number | null, origin: string): void;
};
type Line = Omit<JournalLine, "id" | "at" | "tool" | "whole"> & { tool?: string | null; whole?: boolean };

const TONE: Record<Tone, string> = {
  blue: RUN_TEXT.running,
  amber: RUN_TEXT.waiting_input,
  green: RUN_TEXT.done,
  red: RUN_TEXT.failed,
  muted: RUN_TEXT.cancelled,
};

const HOOK_TONE: Partial<Record<HookEventName, Tone>> = {
  Stop: "green",
  StopFailure: "red",
  SessionEnd: "muted",
};

function hookLine(p: HookPayload): Line | null {
  if (p.question) return { name: "Notification", text: p.question, tone: "amber" };
  if (p.event === "PreToolUse" || p.event === "SessionStart") return null;
  return {
    name: p.event,
    tool: p.tool,
    text: [p.tool, p.detail].filter(Boolean).join(" "),
    tone: HOOK_TONE[p.event] ?? "blue",
    whole: p.event === "Stop",
  };
}

function exitLine(event: Extract<RunEvent, { type: "exited" }>): Line | null {
  const e = fr.agents.events;
  const denied = event.denied.length > 0 ? e.denied(event.denied.join(", ")) : null;
  if (event.isError || event.code !== 0) {
    return { name: event.type, text: event.result ?? denied ?? e.exitCode(event.code), tone: "red" };
  }
  return denied ? { name: event.type, text: denied, tone: "amber" } : null;
}

function eventLine(event: RunEvent): Line | null {
  const e = fr.agents.events;
  switch (event.type) {
    case "spawned":
      return {
        name: "SessionStart",
        text: event.resume ? e.resumed : e.loaded(event.guidelines),
        tone: "blue",
      };
    case "hook":
      return hookLine(event.payload);
    case "exited":
      return exitLine(event);
    case "answered":
      return { name: event.type, text: event.text, tone: "muted", whole: true };
    case "cancelled":
      return { name: event.type, text: "", tone: "muted" };
    case "failed":
      return { name: event.type, text: errorText(event.error), tone: "red" };
    case "prioritized":
      return event.priority ? { name: event.type, text: "", tone: "muted" } : null;
    case "enqueued":
    case "admitted":
    case "reranked":
      return null;
  }
}

export function journalLines(log: RunLogEntry[]): JournalLine[] {
  return log.flatMap((entry) => {
    const line = eventLine(entry.event);
    return line
      ? [{ ...line, tool: line.tool ?? null, whole: line.whole ?? false, id: entry.id, at: entry.at }]
      : [];
  });
}

function JournalText({
  line,
  label,
  files,
}: {
  line: JournalLine;
  label: string;
  files: JournalFiles | null;
}) {
  const shape = line.whole ? "whitespace-pre-wrap break-words" : "line-clamp-3 break-words";
  if (!files) return <span className={shape}>{line.text}</span>;
  const origin = `${files.ticketKey ?? label} · ${[line.name, line.tool].filter(Boolean).join(" ")}`;
  const text = line.text.replaceAll(`${files.worktree}/`, "");
  return (
    <span className={shape}>
      <LinkifiedText text={text} onOpen={(ref) => files.open(ref.path, ref.line, origin)} />
    </span>
  );
}

export const journalUnavailable = (log: { missing: boolean; empty: boolean }, ended: boolean): boolean =>
  log.missing || (log.empty && ended);

type Props = { label: string; log: RunLogEntry[]; files: JournalFiles | null; missing?: boolean };

export function RunJournal({ label, log, files, missing = false }: Props) {
  if (missing)
    return (
      <p className="min-h-0 flex-1 rounded-md border p-3 text-xs text-muted-foreground">
        {frAgentsPage.journalMissing}
      </p>
    );
  const lines = journalLines(log);
  return (
    <ol
      aria-label={fr.agents.journal(label)}
      className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto rounded-md border p-3 text-xs"
    >
      {lines.map((l) => (
        <li key={l.id} data-tone={l.tone} className="grid grid-cols-[3rem_8rem_1fr] gap-2">
          <span className="font-mono text-muted-foreground">{formatClock(l.at)}</span>
          <span className={cn("truncate font-mono", TONE[l.tone])}>{l.name}</span>
          <JournalText line={l} label={label} files={files} />
        </li>
      ))}
    </ol>
  );
}
