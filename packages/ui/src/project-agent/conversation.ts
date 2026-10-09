import { ASK_TOOL, type Batch, type HookPayload, type RunLogEntry, type RunView } from "@kibo/schema";
import { errorText } from "../agents/format";
import { frProjectAgent } from "../i18n/fr-project-agent";

export type ConversationItem =
  | { kind: "user"; id: string; at: number; text: string }
  | { kind: "agent"; id: string; at: number; text: string }
  | { kind: "reading"; id: string; at: number; tools: string[] }
  | { kind: "batch"; id: string; at: number; batch: Batch }
  | { kind: "event"; id: string; at: number; text: string; tone: "muted" | "red"; retry: boolean };

type Reading = Extract<ConversationItem, { kind: "reading" }>;
export type PanelStatus = "ready" | "queued" | "thinking" | "batch";

const KIBO_PREFIX = "mcp__kibo__";
const NOT_READS: ReadonlySet<string> = new Set(["propose_batch", "ask_user", "ask_question"]);
const t = frProjectAgent.conversation;

export function readingTool(payload: HookPayload): string | null {
  if (payload.event !== "PostToolUse" || !payload.tool?.startsWith(KIBO_PREFIX)) return null;
  const name = payload.tool.slice(KIBO_PREFIX.length);
  if (NOT_READS.has(name)) return null;
  return payload.detail ? `${name} ${payload.detail}` : name;
}

class Builder {
  readonly items: ConversationItem[] = [];
  private reading: Reading | null = null;
  private lastUser: string | null = null;
  private failedTurn = false;
  private lastRed = -1;
  private batches: Batch[];

  constructor(batches: readonly Batch[]) {
    this.batches = [...batches].sort((a, b) => a.createdAt - b.createdAt);
  }

  push(item: ConversationItem): void {
    this.reading = null;
    this.items.push(item);
  }

  flushBatches(until: number): void {
    while (this.batches[0] && this.batches[0].createdAt <= until) {
      const batch = this.batches.shift();
      if (batch) this.push({ kind: "batch", id: `batch-${batch.id}`, at: batch.createdAt, batch });
    }
  }

  read(entry: RunLogEntry, tool: string): void {
    if (this.reading) {
      this.reading.tools.push(tool);
      return;
    }
    const item: Reading = { kind: "reading", id: `log-${entry.id}`, at: entry.at, tools: [tool] };
    this.push(item);
    this.reading = item;
  }

  event(entry: RunLogEntry, text: string, tone: "muted" | "red"): void {
    if (tone === "red") this.lastRed = this.items.length;
    this.push({ kind: "event", id: `log-${entry.id}`, at: entry.at, text, tone, retry: false });
  }

  endTurn(entry: RunLogEntry, failed: boolean): void {
    this.failedTurn = failed;
    this.flushBatches(entry.at);
  }

  answered(entry: RunLogEntry, text: string): void {
    this.flushBatches(entry.at - 1);
    if (this.failedTurn && text === this.lastUser) this.event(entry, t.retried, "muted");
    else this.push({ kind: "user", id: `log-${entry.id}`, at: entry.at, text });
    this.lastUser = text;
    this.failedTurn = false;
    this.lastRed = -1;
  }

  finish(run: RunView | null): ConversationItem[] {
    this.flushBatches(Number.POSITIVE_INFINITY);
    const red = this.items[this.lastRed];
    if (run?.state === "failed" && red?.kind === "event") this.items[this.lastRed] = { ...red, retry: true };
    return this.items;
  }
}

function applyHook(b: Builder, entry: RunLogEntry, payload: HookPayload): void {
  const tool = readingTool(payload);
  if (tool) b.read(entry, tool);
  else if (payload.event === "PostToolUse" && payload.tool === ASK_TOOL && payload.question)
    b.push({ kind: "agent", id: `log-${entry.id}`, at: entry.at, text: payload.question });
}

function sessionText(e: Extract<RunLogEntry["event"], { type: "session" }>): string | null {
  if (e.mode === "resumed") return t.resumed;
  return e.reason === "no_previous" ? null : t.fresh(e.reason);
}

function apply(b: Builder, entry: RunLogEntry): void {
  const e = entry.event;
  if (e.type === "answered") b.answered(entry, e.text);
  else if (e.type === "hook") applyHook(b, entry, e.payload);
  else if (e.type === "exited") {
    const clean = e.code === 0 && !e.isError;
    if (clean && e.result) b.push({ kind: "agent", id: `log-${entry.id}`, at: entry.at, text: e.result });
    if (!clean) b.event(entry, t.failed(errorText(e.result ?? `exit code ${e.code}`)), "red");
    b.endTurn(entry, !clean);
  } else if (e.type === "failed") {
    b.event(entry, t.failed(errorText(e.error)), "red");
    b.endTurn(entry, true);
  } else if (e.type === "cancelled") {
    b.event(entry, t.cancelled, "muted");
    b.endTurn(entry, false);
  } else if (e.type === "session") {
    const text = sessionText(e);
    if (text) b.event(entry, text, "muted");
  }
}

export function buildConversation(
  log: readonly RunLogEntry[],
  batches: readonly Batch[],
  run: RunView | null,
): ConversationItem[] {
  const builder = new Builder(batches);
  for (const entry of log) apply(builder, entry);
  return builder.finish(run);
}

export function lastUserMessage(log: readonly RunLogEntry[]): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]?.event;
    if (e?.type === "answered") return e.text;
  }
  return null;
}

export function panelStatus(run: RunView | null, pending: Batch | null): PanelStatus {
  if (pending) return "batch";
  if (run?.state === "queued") return "queued";
  if (run?.state === "starting" || run?.state === "running") return "thinking";
  return "ready";
}
