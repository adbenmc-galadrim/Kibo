export const fr = {
  filter: { mineAndAgents: "Moi + agents", all: "Tous" },
  counter: (shown: number, total: number) => `${shown} / ${total} tickets`,
  newTicketIn: (status: string) => `Nouveau ticket dans ${status}`,
  actions: (key: string) => `Actions ${key}`,
  moveTo: "Déplacer vers",
  moveFailed: (key: string) => `Impossible de déplacer ${key}.`,
  waitingOn: (key: string) => `attend ${key}`,
  blockedReason: (reason: string) => `Motif : ${reason}`,
  run: {
    queued: (position: number | null) => (position === null ? "En file" : `En file #${position}`),
    waiting: "Attend",
    failed: "Échec",
  },
  block: {
    title: (key: string) => `Bloquer ${key}`,
    description: "Un ticket bloqué attend une condition extérieure au projet.",
    reason: "Motif",
    placeholder: "Informations attendues du client",
    cancel: "Annuler",
    confirm: "Bloquer",
  },
};
