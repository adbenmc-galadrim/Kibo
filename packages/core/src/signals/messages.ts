import {
  SIGNAL_BODY_IN_PROMPT_MAX,
  SIGNALS_IN_PROMPT_MAX,
  type Signal,
  type SignalKind,
  type SignalLine,
  type SignalStatus,
  WAKEUP_PREFIX,
} from "@kibo/schema";
import { truncate } from "../project-agent/ticket-facts";
import type { WakePlan } from "./wakeup";

export type WakeReply = WakePlan | { kind: "none" };

export const SIGNAL_KIND_FR: Record<SignalKind, string> = {
  ticket: "ticket à créer",
  context: "contexte",
  blocker: "blocage",
  question: "question",
};

const SIGNAL_KIND_FR_PLURAL: Record<SignalKind, string> = {
  ticket: "tickets à créer",
  context: "contextes",
  blocker: "blocages",
  question: "questions",
};

const STATUS_FR: Record<SignalStatus, string> = {
  new: "nouveau",
  read: "déjà lu",
  handled: "traité",
  ignored: "ignoré",
};

const KIND_ORDER: readonly SignalKind[] = ["ticket", "blocker", "context", "question"];

const counted = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

function wakeText(wake: WakeReply, formatTime: (at: number) => string): string {
  switch (wake.kind) {
    case "now":
      return "Réveil de l'agent de projet demandé (immédiat).";
    case "scheduled":
    case "already":
      return `Réveil de l'agent de projet demandé (prochain réveil possible à ${formatTime(wake.at)}).`;
    case "none":
      return "L'agent de projet le lira à son prochain tour.";
  }
}

export function signalReply(
  signal: Pick<Signal, "ref" | "kind">,
  wake: WakeReply,
  formatTime: (at: number) => string,
): string {
  return `Signal ${signal.ref} enregistré. ${wakeText(wake, formatTime)}`;
}

export function wakeupMessage(signals: readonly Pick<Signal, "kind">[]): string {
  const byKind = KIND_ORDER.flatMap((kind) => {
    const n = signals.filter((s) => s.kind === kind).length;
    return n === 0 ? [] : [counted(n, SIGNAL_KIND_FR[kind], SIGNAL_KIND_FR_PLURAL[kind])];
  });
  return `${WAKEUP_PREFIX}${counted(signals.length, "signal", "signaux")} à traiter (${byKind.join(", ")}). Lis « Signaux à traiter » et propose un lot : cite chaque signal (\`signals\`) dans l'action qui y répond, ou \`dismissSignal\` s'il n'appelle aucune action.`;
}

const WAKEUP_COUNT = /^(\d+) signa(?:l|ux) à traiter/;

export const isWakeupMessage = (text: string): boolean => text.startsWith(WAKEUP_PREFIX);

export function wakeupCount(text: string): number | null {
  if (!isWakeupMessage(text)) return null;
  const match = WAKEUP_COUNT.exec(text.slice(WAKEUP_PREFIX.length));
  return match?.[1] === undefined ? null : Number(match[1]);
}

function signalItem(line: SignalLine, formatTime: (at: number) => string): string[] {
  const head = [
    line.ref,
    SIGNAL_KIND_FR[line.kind],
    line.runLabel,
    line.ticketKey,
    formatTime(line.createdAt),
    STATUS_FR[line.status],
  ].join(" · ");
  const body = line.body.trim() ? truncate(line.body.trim(), SIGNAL_BODY_IN_PROMPT_MAX).split("\n") : [];
  return [`- ${head} — « ${line.title} »`, ...body.map((l) => `  ${l}`)];
}

export function renderSignalsSection(
  lines: readonly SignalLine[],
  formatTime: (at: number) => string,
): string {
  if (lines.length === 0) return "";
  const oldest = [...lines].sort((a, b) => a.createdAt - b.createdAt);
  const shown = oldest.slice(0, SIGNALS_IN_PROMPT_MAX);
  const rest = oldest.length - shown.length;
  return [
    "## Signaux à traiter",
    "",
    ...shown.flatMap((l) => signalItem(l, formatTime)),
    ...(rest > 0 ? [`- … ${rest} autres : \`list_signals\``] : []),
  ].join("\n");
}
