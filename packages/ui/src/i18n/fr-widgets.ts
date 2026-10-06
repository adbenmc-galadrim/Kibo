const FIELDS: Record<string, string> = { filter: "Filtre" };
const VALUES: Record<string, string> = {
  "mine-and-agents": "Moi + agents",
  all: "Tous",
  mine: "Mes tickets",
  soft: "Doux",
  studio: "Studio",
  contrast: "Contraste",
};

export const frWidgets = {
  title: (name: string) => `Réglages · ${name}`,
  help: "Ces réglages ne concernent que ce widget.",
  save: "Enregistrer",
  cancel: "Annuler",
  noValue: "Aucune valeur",
  assetNone: "Aucun",
  assetLoading: "Chargement des fichiers…",
  assetChoose: "Choisir un fichier",
  assetsFailed: "Impossible de lister les fichiers du projet.",
  assetMissing: (name: string) => `${name} (introuvable sur cet appareil)`,
  filesLink: "Fichiers du projet…",
  fileRequired: (label: string) => `Choisis un fichier : ${label}.`,
  invalid: (errors: string[]) => `Réglages refusés : ${errors.join(" ; ")}`,
  failed: "Impossible d'enregistrer les réglages.",
  fieldLabel: (key: string) => FIELDS[key] ?? key,
  valueLabel: (value: string | number | boolean) => VALUES[String(value)] ?? String(value),
};
