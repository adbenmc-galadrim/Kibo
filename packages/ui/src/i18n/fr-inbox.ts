import type { KiboErrorCode } from "@kibo/schema";
import { fr } from "./fr";

export const frInbox = {
  title: fr.nav.inbox,
  subtitle: "Les tickets qui n'ont pas encore de projet. Rattache-les quand tu sais où ils vont.",
  empty: "Rien en attente.",
  emptyHelp: "Les tickets créés sans projet arrivent ici.",
  newTicket: "Nouveau ticket",
  columns: { key: "Clé", title: "Titre", status: "Statut", assignee: "Assigné", actions: "Actions" },
  nobody: "—",
  actions: (key: string) => `Actions pour ${key}`,
  file: "Rattacher…",
  fileTo: "Rattacher à un projet…",
  open: "Ouvrir",
  remove: "Supprimer…",
  dialog: {
    title: (key: string) => `Rattacher ${key} à un projet`,
    project: "Projet",
    nextKey: (key: string) => `Le ticket reçoit une nouvelle clé dans ce projet (la prochaine est ${key}).`,
    serverKey: "Sa clé sera attribuée par le serveur de sync.",
    children: "Ses sous-tickets suivent.",
    links: "Ses liens vers d'autres tickets de la boîte sont perdus.",
    confirm: "Rattacher",
    cancel: "Annuler",
    noProject: "Aucun projet modifiable : crée un projet d'abord.",
    errors: {
      FORBIDDEN: "Ce projet est en lecture seule pour toi.",
      CONFLICT: "Ce projet est en cours de partage : réessaie dans un instant.",
      NOT_FOUND: "Ce ticket ou ce projet n'existe plus.",
    } satisfies Partial<Record<KiboErrorCode, string>>,
    failed: "Impossible de rattacher ce ticket.",
  },
  noAgent: "Rattache d'abord ce ticket à un projet : un agent travaille dans le dossier d'un projet.",
};
