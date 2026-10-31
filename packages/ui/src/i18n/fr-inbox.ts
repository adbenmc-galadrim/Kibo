import type { KiboErrorCode } from "@kibo/schema";

export const frInbox = {
  fileTo: "Rattacher à un projet…",
  dialog: {
    title: (key: string) => `Rattacher ${key} à un projet`,
    project: "Projet",
    nextKey: (key: string) => `Le ticket reçoit une nouvelle clé dans ce projet (la prochaine est ${key}).`,
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
};
