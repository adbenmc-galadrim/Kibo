export const frAgentsPage = {
  subtitle: "Un run est le travail d'un agent sur un ticket.",
  stats: {
    slots: (used: number, total: number) => `${used} place${used > 1 ? "s" : ""} sur ${total}`,
    tokensHelp: "Comptés par Claude Code sur ton abonnement.",
  },
  filters: {
    label: "Filtrer par état",
    all: "Tous",
    done: "Terminés",
    failed: "En échec",
    cancelled: "Annulés",
    waiting: "En attente",
  },
  searchKey: "Clé du ticket",
  searchPlaceholder: "KIB-12",
  noMatch: "Aucun run ne correspond à ce filtre.",
  openRun: (profile: string, subject: string) => `${profile} · ${subject}`,
  permissionModes: {
    plan: "Lecture seule (plan)",
    acceptEdits: "Modifications acceptées",
    default: "Demande à chaque action",
  },
} as const;
