import type { ComponentFormat } from "@kibo/schema";

export const devFr = {
  widget: "Widget",
  view: "Vue",
  dark: "Sombre",
  light: "Clair",
  surface: "Affichage",
  format: "Format",
  formats: {
    small: "Petit",
    medium: "Moyen",
    large: "Large",
    half: "Demi-page",
    full: "Plein écran",
  } satisfies Record<ComponentFormat, string>,
  theme: "Thème",
  modes: "Modes",
  visible: "Visible",
  focus: "Mode plein écran",
  hint: "Aperçu local avec le jeu de données fictif ; rien n'est envoyé au démon.",
};
