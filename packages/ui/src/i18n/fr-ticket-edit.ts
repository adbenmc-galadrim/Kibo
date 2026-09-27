import type { KiboErrorCode } from "@kibo/schema";

const s = (n: number) => (n > 1 ? "s" : "");

export const frTicketEdit = {
  editTitle: "Modifier le titre",
  titleField: "Titre",
  titleHint: "Entrée pour enregistrer · Échap pour annuler",
  editDescription: "Modifier",
  descriptionField: "Description",
  descriptionPlaceholder: "Décris le ticket…",
  save: "Enregistrer",
  cancel: "Annuler",
  assignee: "Assigné",
  nobody: "Personne",
  me: "Moi",
  agentAssignee: "Choisis un profil via Assigner à un agent",
  actions: (key: string) => `Actions ${key}`,
  openInTab: "Ouvrir dans un onglet",
  copyKey: "Copier la clé",
  copied: "Clé copiée",
  copyFailed: "Impossible de copier la clé.",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${s(children)} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  block: {
    title: (key: string) => `Bloquer ${key}`,
    description: "Un ticket bloqué attend une condition extérieure au projet.",
    reason: "Motif",
    placeholder: "Informations attendues du client",
    confirm: "Bloquer",
    cancel: "Annuler",
  },
  errors: {
    INVALID_INPUT: "Le titre ne peut pas être vide.",
    BLOCKED_REASON_REQUIRED: "Un motif est requis pour bloquer un ticket.",
    FORBIDDEN: "Ce projet est en lecture seule.",
    NOT_FOUND: "Ce ticket n'existe plus.",
    TREE_CYCLE: "Un ticket ne peut pas devenir son propre sous-ticket.",
  } satisfies Partial<Record<KiboErrorCode, string>>,
  fallback: "Impossible d'enregistrer la modification.",
};
