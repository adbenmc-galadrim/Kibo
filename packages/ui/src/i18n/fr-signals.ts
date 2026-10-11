import type { SignalKind } from "@kibo/schema";

const signals = (n: number) => `${n} signa${n > 1 ? "ux" : "l"}`;

export const frSignals = {
  kinds: {
    ticket: "Ticket à créer",
    context: "Contexte",
    blocker: "Blocage",
    question: "Question",
  } satisfies Record<SignalKind, string>,
  box: {
    title: (n: number) => `En boîte · ${n}`,
    empty:
      "Aucun signal. Les agents de ticket te signaleront ici tickets à créer, blocages, contexte et questions.",
    from: "de",
    on: "sur",
    ignore: "Ignorer",
    openTicket: "Ouvrir le ticket",
    showBody: "Afficher le détail",
    hideBody: "Masquer le détail",
    closed: "Traités",
    handledIn: (seq: number) => `traité dans le lot n° ${seq}`,
    handled: "traité dans un lot",
    ignored: "ignoré",
    dismissedIn: (seq: number) => `sans suite, lot n° ${seq}`,
    loadFailed: "Impossible de charger les signaux.",
    ignoreFailed: "Signal non ignoré.",
  },
  wakeup: {
    label: "Réveil automatique",
    due: (time: string) => `prochain réveil à ${time}`,
    last: (time: string) => `dernier réveil à ${time}`,
    none: "aucun réveil prévu",
    event: (n: number) => `Réveil automatique · ${signals(n)}`,
  },
  button: {
    signals: (n: number) => `${signals(n)} en boîte`,
    open: "Ouvrir la boîte à signaux",
  },
  provenance: (kind: string, run: string) => `signal ${kind} de ${run}`,
  provenancePrefix: (kind: string) => `signal ${kind} de`,
  moment: (kind: string, title: string) => `Signal à l'agent de projet · ${kind} · « ${title} »`,
} as const;
