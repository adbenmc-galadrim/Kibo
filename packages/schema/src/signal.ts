import { z } from "zod";
import { TicketKey } from "./ids";
import type { McpToolSpec } from "./progress";
import { Actor } from "./question";

export const SIGNAL_KINDS = ["ticket", "context", "blocker", "question"] as const;
export const SignalKind = z.enum(SIGNAL_KINDS);
export type SignalKind = z.infer<typeof SignalKind>;

export const SIGNAL_TITLE_MAX = 200;
export const SIGNAL_BODY_MAX = 4_000;
export const SIGNALS_PER_RUN_MAX = 20;
export const SIGNAL_REFS_MAX = 20;
export const SIGNALS_IN_PROMPT_MAX = 50;
export const SIGNAL_BODY_IN_PROMPT_MAX = 500;
export const SIGNAL_WAKE_WINDOW_MS = 10 * 60_000;
export const SIGNALS_CLOSED_SHOWN = 20;
export const WAKE_KINDS: readonly SignalKind[] = ["ticket", "blocker"];

export const ActionId = z.number().int().positive();

export const SignalInput = z.object({
  kind: SignalKind,
  title: z.string().trim().min(1).max(SIGNAL_TITLE_MAX),
  body: z.string().max(SIGNAL_BODY_MAX).default(""),
  ticket: TicketKey.optional(),
});
export type SignalInput = z.infer<typeof SignalInput>;

export const SIGNAL_REF_PATTERN = "^sig:[1-9]\\d{0,5}$";
export const SignalRef = z.string().regex(new RegExp(SIGNAL_REF_PATTERN));
export type SignalRef = z.infer<typeof SignalRef>;
export const signalRef = (seq: number): SignalRef => `sig:${seq}`;
export const seqOfRef = (ref: SignalRef): number => Number(ref.slice("sig:".length));

export const SignalStatus = z.enum(["new", "read", "handled", "ignored"]);
export type SignalStatus = z.infer<typeof SignalStatus>;

export const SignalEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("read"), runId: z.string().min(1) }),
  z.object({ type: z.literal("handled"), batchId: z.string().min(1), actionId: ActionId }),
  z.object({
    type: z.literal("ignored"),
    by: Actor,
    batchId: z.string().min(1).nullable(),
    actionId: ActionId.nullable(),
  }),
]);
export type SignalEvent = z.infer<typeof SignalEvent>;
export type TimedSignalEvent = { at: number; event: SignalEvent };

export type SignalRow = {
  id: string;
  seq: number;
  projectId: string;
  runId: string;
  runLabel: string;
  profileName: string;
  originTicketId: string;
  originTicketKey: string;
  ticketId: string;
  ticketKey: string;
  kind: SignalKind;
  title: string;
  body: string;
  createdAt: number;
};

export type Signal = SignalRow & {
  ref: SignalRef;
  status: SignalStatus;
  readAt: number | null;
  readRunId: string | null;
  decidedAt: number | null;
  batchId: string | null;
  actionId: number | null;
  decidedBy: Actor | null;
};

export const isOpenSignal = (s: Pick<Signal, "status">): boolean => s.status === "new" || s.status === "read";

function foldEvent(signal: Signal, { at, event }: TimedSignalEvent): Signal {
  if (!isOpenSignal(signal)) return signal;
  switch (event.type) {
    case "read":
      return signal.status === "new"
        ? { ...signal, status: "read", readAt: at, readRunId: event.runId }
        : signal;
    case "handled":
      return {
        ...signal,
        status: "handled",
        decidedAt: at,
        batchId: event.batchId,
        actionId: event.actionId,
      };
    case "ignored":
      return {
        ...signal,
        status: "ignored",
        decidedAt: at,
        decidedBy: event.by,
        batchId: event.batchId,
        actionId: event.actionId,
      };
  }
}

export function foldSignal(row: SignalRow, events: readonly TimedSignalEvent[]): Signal {
  const initial: Signal = {
    ...row,
    ref: signalRef(row.seq),
    status: "new",
    readAt: null,
    readRunId: null,
    decidedAt: null,
    batchId: null,
    actionId: null,
    decidedBy: null,
  };
  return events.reduce(foldEvent, initial);
}

export type Wakeup = { projectId: string; lastAt: number | null; dueAt: number | null };
export type SignalsView = { signals: Signal[]; wakeup: Wakeup };
export type ProjectSignalCount = { projectId: string; open: number; unread: number };

export const SIGNAL_TOOL_NAME = "signal_project" as const;
export const SIGNAL_TOOL = `mcp__kibo__${SIGNAL_TOOL_NAME}`;
export const WAKEUP_PREFIX = "Réveil automatique : ";
const WAKEUP_COUNT = /^(\d+) signa(?:l|ux) à traiter/;

export const isWakeupMessage = (text: string): boolean => text.startsWith(WAKEUP_PREFIX);

export function wakeupCount(text: string): number | null {
  if (!isWakeupMessage(text)) return null;
  const match = WAKEUP_COUNT.exec(text.slice(WAKEUP_PREFIX.length));
  return match?.[1] === undefined ? null : Number(match[1]);
}
export const PROJECT_SIGNAL_TOOLS = ["list_signals"] as const;

export const SIGNAL_PROJECT_SPEC: McpToolSpec = {
  name: SIGNAL_TOOL_NAME,
  description:
    "Tell the project agent something it should act on: a ticket to create (kind ticket), a blocker, useful context, or a question. Nothing is created by this call: the project agent proposes, the user validates. 20 signals per run at most.",
  inputSchema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [...SIGNAL_KINDS],
        description:
          "ticket: a ticket to create; blocker: what blocks you; context: useful knowledge; question.",
      },
      title: { type: "string", maxLength: SIGNAL_TITLE_MAX, description: "Short title, in French." },
      body: { type: "string", maxLength: SIGNAL_BODY_MAX, description: "Optional details, in Markdown." },
      ticket: {
        type: "string",
        pattern: "^[A-Z]{2,6}-\\d+$",
        description: "Key of the ticket concerned, in this project. Defaults to the ticket of this run.",
      },
    },
    required: ["kind", "title"],
  },
};

export type SignalLine = {
  ref: SignalRef;
  kind: SignalKind;
  runLabel: string;
  ticketKey: string;
  createdAt: number;
  status: SignalStatus;
  title: string;
  body: string;
};

export const signalLine = (s: Signal): SignalLine => ({
  ref: s.ref,
  kind: s.kind,
  runLabel: s.runLabel,
  ticketKey: s.ticketKey,
  createdAt: s.createdAt,
  status: s.status,
  title: s.title,
  body: s.body,
});
