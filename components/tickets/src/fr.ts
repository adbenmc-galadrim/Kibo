export const fr = {
  title: "Tickets",
  newTicket: "Nouveau ticket",
  empty: "Aucun ticket pour l'instant.",
  columns: { ticket: "Ticket", status: "Statut", assignee: "Assigné", progress: "Sous-tickets" },
  unassigned: "—",
  collapse: (key: string) => `Replier ${key}`,
  expand: (key: string) => `Déplier ${key}`,
  newSubTicket: (key: string) => `Nouveau sous-ticket de ${key}`,
  waitingOn: (keys: string[]) => `attend ${keys.join(", ")}`,
  run: {
    queued: (position: number | null) => (position === null ? "En file" : `En file #${position}`),
    waiting: "Attend",
    failed: "Échec",
  },
};
