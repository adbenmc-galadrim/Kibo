import type { SignalKind } from "@kibo/schema";

const signals = (n: number) => `${n} signa${n > 1 ? "ux" : "l"}`;

export const frSignals = {
  kinds: {
    ticket: "Ticket à créer",
    context: "Contexte",
    blocker: "Blocage",
    question: "Question",
  } satisfies Record<SignalKind, string>,
  wakeup: {
    label: "Réveil automatique",
    event: (n: number) => `Réveil automatique · ${signals(n)}`,
    answered: (label: string, quote: string) => `${label} répondue : « ${quote} »`,
  },
  button: {
    signals: (n: number) => `${signals(n)} en boîte`,
  },
  provenance: (kind: string, run: string) => `signal ${kind} de ${run}`,
  provenancePrefix: (kind: string) => `signal ${kind} de`,
  moment: (kind: string, title: string) => `Signal à l'agent de projet · ${kind} · « ${title} »`,
} as const;
