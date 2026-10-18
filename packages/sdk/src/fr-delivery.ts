import type { StartReason } from "@kibo/schema";

const tickets = (n: number) => `${n} ticket${n > 1 ? "s" : ""}`;

export const deliveryTexts = {
  deliver: "Livrer",
  retouch: "Livrer la retouche",
  copy: (command: string) => `Copier ${command}`,
  copied: (waiting: readonly string[], question: string | null = null) =>
    [
      "Copié",
      ...(question ? [`bloqué par ${question}`] : []),
      ...(waiting.length > 0 ? [`attend ${waiting.join(", ")}`] : []),
    ].join(" · "),
  copiedBecause: (reason: string) => `Copié · ${reason}`,
  reason: (reason: StartReason): string | null => {
    switch (reason.kind) {
      case "dependency":
        return `attend ${reason.keys.join(", ")}`;
      case "question":
        return `bloqué par ${reason.label}`;
      case "sprint":
        return `sprint ${reason.code}`;
      case "unplanned":
        return "sans sprint";
      case "limit":
        return `limite ${reason.count}/${reason.limit} atteinte`;
      case "status":
        return null;
    }
  },
  copyFailed: "Copie impossible",
  busy: (label: string) => `déjà un run : ${label}`,
  blockedBy: (keys: readonly string[]) => `bloqué par ${keys.join(", ")}`,
  blockingQuestion: "question bloquante",
  failed: (key: string, detail: string) => `Échec de la livraison de ${key} : ${detail}`,
  noAgent: "Choisis l'agent qui livre, ou applique le préréglage Livraison à un agent.",
  notStarted: "la livraison n'a pas démarré",
  parentTicket: "ce ticket regroupe des sous-tickets",
  lazy: { loading: "Chargement…", failed: "Impossible d'ouvrir les sous-tickets.", retry: "Réessayer" },
  children: {
    title: (key: string) => `Livrer les sous-tickets de ${key}`,
    description: (title: string, count: number) =>
      `${title} regroupe ${count} sous-ticket${count > 1 ? "s" : ""}. Kibo les livre un par un, dans l'ordre des dépendances.`,
    list: "Sous-tickets",
    after: (keys: readonly string[]) => `après ${keys.join(", ")}`,
    states: {
      ready: "prêt",
      done: "livré",
      blocked: (keys: readonly string[]) => (keys.length > 0 ? `bloqué par ${keys.join(", ")}` : "bloqué"),
      question: "question bloquante",
      busy: "run en cours",
      status: "en cours",
    },
    help: "Les tickets prêts sont cochés ; la file de Kibo et les places de l'agent font le reste.",
    nothing: (key: string, state: string) => `Rien à livrer : ${key} ${state}.`,
    submit: (n: number) => `Livrer ${tickets(n)}`,
    cancel: "Annuler",
  },
};
