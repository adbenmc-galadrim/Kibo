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
  page: {
    title: "Créations",
    subtitle: "Les composants que l'IA écrit pour toi. Une création continue même si tu fermes son dialogue.",
    active: (n: number) => `En cours (${n})`,
    finished: (n: number) => `Terminées (${n})`,
    empty: "Aucune création pour l'instant.",
    create: "Créer un composant",
    loading: "Chargement des créations…",
    columns: {
      component: "Composant",
      mode: "Type",
      progress: "Avancement",
      updated: "Mis à jour",
      actions: "Actions",
    },
  },
  row: {
    modes: { create: "Création", modify: "Modification" },
    queued: (position: number) => `En file #${position}`,
    running: "En cours",
    waiting: "Attend une réponse",
    published: "Publié",
    abandoned: "Abandonné",
    attempts: (n: number) => (n > 1 ? `${n} tentatives` : `${n} tentative`),
    revisions: (n: number) => (n > 1 ? `${n} révisions` : `${n} révision`),
    updated: (when: string) => `mis à jour ${when}`,
    open: "Ouvrir",
    openLabel: (title: string) => `Ouvrir ${title}`,
    journal: "Journal",
    journalLabel: (title: string) => `Journal de ${title}`,
    abandon: "Abandonner…",
    abandonLabel: (title: string) => `Abandonner ${title}`,
  },
  abandon: {
    title: (title: string) => `Abandonner ${title} ?`,
    description: "Le brouillon et ses images sont supprimés ; le run en cours est arrêté.",
    confirm: "Abandonner",
  },
};
