import { fr } from "./fr";

export const frAgentBar = {
  states: {
    queued: "En file",
    starting: "Démarrage",
    running: "En cours",
    waiting_input: "Attend une réponse",
    done: "Terminé",
    failed: "Échec",
    cancelled: "Annulé",
    doneWithQuestions: (n: number) => `Terminé · ${fr.agents.questionCount(n)}`,
  },
  reasons: {
    paused: "admission en pause",
    cpu: (value: number, threshold: number) => `CPU ${value} % (seuil ${threshold} %)`,
    ram: (value: number, threshold: number) => `RAM ${value} % (seuil ${threshold} %)`,
    host: (used: number, total: number) => `attend une place sur la machine (${used}/${total})`,
    agent: (name: string, used: number, total: number) =>
      `attend une place de l'agent ${name} (${used}/${total})`,
    agentMissing: "agent supprimé",
    ticketBusy: "un run de ce ticket est déjà en cours ou en file",
    parentTicket: (children: number) =>
      `ticket parent (${children} sous-tickets) : lance plutôt ses sous-tickets`,
    next: "admission au prochain passage",
  },
} as const;
