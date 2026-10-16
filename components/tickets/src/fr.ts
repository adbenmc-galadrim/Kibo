import type { PrState } from "@kibo/schema";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const PR_STATES: Record<PrState, string | null> = {
  open: null,
  draft: "brouillon",
  merged: "fusionnée",
  closed: "fermée",
};

export const fr = {
  title: "Tickets",
  mine: "Mes tickets",
  newTicket: "Nouveau ticket",
  empty: "Aucun ticket pour l'instant.",
  emptyHelp: "Une fonctionnalité regroupe des étapes ; chaque étape est un ticket, livré dans l'ordre.",
  noMatch: "Aucun ticket ne correspond.",
  clear: "Effacer",
  summary: (scope: string, tickets: number, features: number) =>
    `${scope} · ${plural(tickets, "ticket", "tickets")} dans ${plural(features, "fonctionnalité", "fonctionnalités")}`,
  scope: {
    all: "tous les sprints",
    none: "à planifier",
    sprint: (name: string) => `sprint ${name}`,
  },
  sprints: {
    label: "Sprint affiché",
    all: "Tous les sprints",
    none: "À planifier",
    current: "sprint en cours",
  },
  filters: {
    open: "Ouverts",
    feature: "Fonctionnalité",
    allFeatures: "Toutes les fonctionnalités",
    sort: { recent: "Activité récente", key: "Clé" },
  },
  columns: {
    key: "Clé",
    title: "Titre",
    feature: "Fonctionnalité",
    status: "État",
    git: "Git et PR",
    delivery: "Livraison",
    updated: "Mis à jour",
  },
  done: (sprint: string | null) => (sprint === null ? "Terminés" : `Terminés dans ${sprint}`),
  loose: "Hors fonctionnalité",
  collapse: (section: string) => `Replier ${section}`,
  expand: (section: string) => `Déplier ${section}`,
  footer:
    "États tirés de git : branche créée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé. Étapes posées par kibo tickets step.",
  feature: {
    open: (name: string) => `Ouvrir la fonctionnalité ${name}`,
    name: (key: string, title: string) => `${key} · ${title}`,
  },
  git: {
    waiting: (keys: readonly string[]) => `attend ${keys.join(", ")}`,
    prState: (state: PrState) => PR_STATES[state],
    pr: (n: number) => `#${n}`,
    ci: { ok: "CI réussie", error: "CI cassée", running: "CI en cours", neutral: "CI sans conclusion" },
  },
  none: "—",
  running: "Agent en cours",
  updated: {
    now: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    yesterday: "hier",
  },
  newSubTicket: (key: string) => `Nouveau sous-ticket de ${key}`,
  questions: (n: number) => `${n} question${n > 1 ? "s" : ""}`,
  questionsOpen: (n: number) => `${n} question${n > 1 ? "s" : ""}, ouvrir`,
  actions: (key: string) => `Actions ${key}`,
  open: "Ouvrir",
  status: "Statut",
  newSub: "Nouveau sous-ticket",
  moveToRoot: "Déplacer à la racine",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${children > 1 ? "s" : ""} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  cancel: "Annuler",
  statusFailed: (key: string) => `Impossible de changer le statut de ${key}.`,
  moveFailed: (key: string) => `Impossible de déplacer ${key}.`,
  cycle: "Un ticket ne peut pas devenir le sous-ticket de l'un de ses sous-tickets.",
  block: {
    title: (key: string) => `Bloquer ${key}`,
    description: "Un ticket bloqué attend une condition extérieure au projet.",
    reason: "Motif",
    placeholder: "Informations attendues du client",
    cancel: "Annuler",
    confirm: "Bloquer",
  },
};
