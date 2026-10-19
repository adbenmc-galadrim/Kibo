import {
  type AnsweredLine,
  answeredLine,
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

export type WakeupInput = {
  signals: readonly Pick<Signal, "kind">[];
  answers: readonly AnsweredLine[];
};

const SIGNAL_RULE =
  "Lis « Signaux à traiter » et propose un lot : cite chaque signal (`signals`) dans l'action qui y répond, ou `dismissSignal` s'il n'appelle aucune action.";

const ANSWER_RULE =
  "Lis chaque réponse (`list_questions`, `get_ticket`) et propose un lot seulement si elle appelle une action : lever un blocage (`setStatus`), ajuster ou reprendre une étape (`updateTicket`, `setHold`), prévenir le client (`createQuestion` à son destinataire) ; sinon dis en une phrase ce que tu en retiens, sans lot.";

function signalsCount(signals: readonly Pick<Signal, "kind">[]): string {
  const byKind = KIND_ORDER.flatMap((kind) => {
    const n = signals.filter((s) => s.kind === kind).length;
    return n === 0 ? [] : [counted(n, SIGNAL_KIND_FR[kind], SIGNAL_KIND_FR_PLURAL[kind])];
  });
  return `${counted(signals.length, "signal", "signaux")} à traiter (${byKind.join(", ")})`;
}

export function wakeupMessage({ signals, answers }: WakeupInput): string {
  if (answers.length === 0) return `${WAKEUP_PREFIX}${signalsCount(signals)}. ${SIGNAL_RULE}`;
  const read = counted(answers.length, "réponse à lire", "réponses à lire");
  const lines = answers.map(answeredLine).join("\n");
  if (signals.length === 0) return `${WAKEUP_PREFIX}${read}.\n${lines}\n${ANSWER_RULE}`;
  return `${WAKEUP_PREFIX}${signalsCount(signals)} et ${read}.\n${lines}\n${SIGNAL_RULE} ${ANSWER_RULE}`;
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
