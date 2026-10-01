import type { ComponentFormat } from "@kibo/schema";

const cell = (x: number, y: number) => `colonne ${x + 1}, rangée ${y + 1}`;

export const frLayout = {
  title: "Disposition",
  formats: {
    small: "Petit",
    medium: "Moyen",
    large: "Large",
    half: "Demi-page",
    full: "Plein écran",
  } satisfies Record<ComponentFormat, string>,
  size: (w: number, h: number) => `${w} × ${h}`,
  toolbar: (n: number) => (n === 0 ? "Aucun changement" : n === 1 ? "1 changement" : `${n} changements`),
  save: "Enregistrer",
  cancel: "Annuler",
  move: (title: string) => `Déplacer ${title}`,
  format: (title: string) => `Format de ${title}`,
  current: (label: string) => `Format : ${label}`,
  remove: (title: string) => `Retirer ${title}`,
  noRoom: "Pas de place",
  help: "Un composant s'adapte à chacun de ses formats.",
  saveFailed: (title: string) => `La disposition de ${title} n'a pas été enregistrée.`,
  instructions:
    "Pour déplacer un widget, appuie sur Espace ou Entrée, déplace-le avec les flèches, puis appuie sur Espace ou Entrée pour le poser. Échap annule.",
  picked: (title: string) => `${title} saisi.`,
  over: (title: string, x: number, y: number, free: boolean) =>
    `${title} : ${cell(x, y)}${free ? "." : ", la place est prise."}`,
  dropped: (title: string, x: number, y: number) => `${title} posé ${cell(x, y)}.`,
  refused: (title: string) => `${title} n'a pas bougé : la place est prise.`,
  canceled: (title: string) => `Déplacement de ${title} annulé.`,
};
