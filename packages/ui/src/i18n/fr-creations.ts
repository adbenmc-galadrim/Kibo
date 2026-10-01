import type { ComponentFormat } from "@kibo/schema";

const FORMAT_LABELS: Record<ComponentFormat, string> = {
  small: "Petit",
  medium: "Moyen",
  large: "Large",
  half: "Demi-page",
  full: "Plein écran",
};

export const frCreations = {
  attachments: {
    label: "Maquettes (facultatif)",
    help: "Glisse, colle ou choisis jusqu'à 4 images (PNG, JPEG, WebP, 256 ko max).",
    pick: "Ajouter des images",
    choose: "Choisir des images",
    list: "Images jointes",
    remove: (name: string) => `Retirer ${name}`,
    removeShort: "Retirer",
    size: (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} ko`,
    refusals: {
      count: "4 images au plus : retire une image pour en ajouter une autre.",
      format: "Format non pris en charge : PNG, JPEG ou WebP.",
      "too-large": "Image trop lourde : 256 ko au plus.",
    },
    readFailed: "Impossible de lire cette image.",
  },
  formats: {
    label: "Formats",
    help: "Les tailles que le composant sait occuper sur un tableau de bord.",
    labels: FORMAT_LABELS,
    none: "Choisis au moins un format.",
    viewNeedsFull: "Une vue s'affiche en plein écran : garde « Plein écran ».",
    widgetNeedsSmaller: "Un widget garde au moins un format autre que « Plein écran ».",
  },
  background: {
    action: "Continuer en arrière-plan",
  },
  banner: {
    title: (n: number) => (n === 1 ? "1 création en cours" : `${n} créations en cours`),
    line: (title: string, step: string) => `${title} · ${step}`,
    resume: "Reprendre",
    all: "Voir les créations",
  },
  modify: {
    title: "Modifier avec l'IA",
  },
};
