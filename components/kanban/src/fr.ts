export const fr = {
  lazy: { loading: "Chargement du Kanban…", failed: "Impossible de charger le Kanban.", retry: "Réessayer" },
  filter: { mineAndAgents: "Moi + agents", all: "Tous" },
  counter: (shown: number, total: number) => `${shown} / ${total} tickets`,
  newTicketIn: (status: string) => `Nouveau ticket dans ${status}`,
  actions: (key: string) => `Actions ${key}`,
  moveTo: "Déplacer vers",
  open: "Ouvrir",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${children > 1 ? "s" : ""} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  cancel: "Annuler",
  moveFailed: (key: string) => `Impossible de déplacer ${key}.`,
  waitingOn: (key: string) => `attend ${key}`,
  blockedReason: (reason: string) => `Motif : ${reason}`,
  ci: { ok: "CI réussie", error: "CI cassée", running: "CI en cours", neutral: "CI sans verdict" },
  ciUnavailable: (message: string) => `CI indisponible : ${message}`,
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
