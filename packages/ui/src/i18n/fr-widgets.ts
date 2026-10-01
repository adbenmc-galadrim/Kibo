const FIELDS: Record<string, string> = { filter: "Filtre" };
const VALUES: Record<string, string> = {
  "mine-and-agents": "Moi + agents",
  all: "Tous",
  mine: "Mes tickets",
};

export const frWidgets = {
  title: (name: string) => `Réglages · ${name}`,
  help: "Ces réglages ne concernent que ce widget.",
  save: "Enregistrer",
  cancel: "Annuler",
  noValue: "Aucune valeur",
  invalid: (errors: string[]) => `Réglages refusés : ${errors.join(" ; ")}`,
  failed: "Impossible d'enregistrer les réglages.",
  fieldLabel: (key: string) => FIELDS[key] ?? key,
  valueLabel: (value: string | number | boolean) => VALUES[String(value)] ?? String(value),
};
