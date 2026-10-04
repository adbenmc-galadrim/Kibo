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
  resizeRight: (title: string) => `Redimensionner ${title} (droite)`,
  resizeBottom: (title: string) => `Redimensionner ${title} (bas)`,
  resizeCorner: (title: string) => `Redimensionner ${title} (coin)`,
  cells: (w: number, h: number) => `${w} × ${h} cases`,
  sized: (title: string, w: number, h: number) => `${title} : ${w} × ${h} cases.`,
  sizeLabel: (w: number, h: number) => `Taille · ${w} × ${h}`,
  shortcuts: "Raccourcis de taille",
  help: "Un composant s'adapte à chacun de ses formats.",
  saveFailed: (title: string) => `La disposition de ${title} n'a pas été enregistrée.`,
  instructions:
    "Pour déplacer un widget, appuie sur Espace ou Entrée, déplace-le avec les flèches, puis appuie sur Espace ou Entrée pour le poser. Échap annule.",
  picked: (title: string) => `${title} saisi.`,
  over: (title: string, x: number, y: number) => `${title} : ${cell(x, y)}.`,
  dropped: (title: string, x: number, y: number) => `${title} posé ${cell(x, y)}.`,
  canceled: (title: string) => `Déplacement de ${title} annulé.`,
};
