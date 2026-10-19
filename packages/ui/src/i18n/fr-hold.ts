import { HOLD_REASON_MAX } from "@kibo/schema";
import { frFeature } from "./fr-group";

export const frHold = {
  menu: "Mettre en attente…",
  resume: "Reprendre",
  dialog: {
    title: (key: string) => `Mettre ${key} en attente`,
    description:
      "L'étape attend une chose que l'équipe n'a pas encore : un environnement, des accès, une décision du client.",
    reason: "Raison",
    placeholder: "Environnement de recette du client",
    suggestions: "Raisons déjà employées",
    counter: (n: number) => `${n}/${HOLD_REASON_MAX}`,
    confirm: "Mettre en attente",
    cancel: "Annuler",
  },
  banner: {
    label: "Étape en attente",
    own: (reason: string, day: string) => `En attente · ${reason} · depuis le ${day}`,
    dependency: (key: string) => `En attente de ${key}`,
    resume: "Reprendre",
    open: (key: string) => `Ouvrir ${key}`,
  },
  feature: {
    hint: "la fonctionnalité avance sans elles",
    bar: (n: number) => `${n} en attente`,
    since: (reason: string, day: string) => `${reason} · depuis le ${day}`,
  },
  errors: { INVALID_INPUT: "Une étape terminée ne se met pas en attente." },
  fallback: "La mise en attente a échoué.",
};

export function holdDay(since: string): string {
  const [, month, day] = since.split("-").map(Number);
  return `${day ?? ""} ${frFeature.month((month ?? 1) - 1)}`;
}
