export const frFields = {
  folder: {
    browse: "Parcourir…",
    pickFailed: "Impossible d'ouvrir le sélecteur de dossier.",
  },
  icon: {
    choose: "Choisir une image…",
    remove: "Retirer l'image",
    help: "PNG, JPEG ou WebP, 256 kB au plus. Une image carrée rend mieux.",
    tooLarge: "Image trop lourde : 256 kB au plus.",
    badFormat: "Format non pris en charge : PNG, JPEG ou WebP.",
    readFailed: "Impossible de lire ce fichier.",
    preview: (label: string) => `Image · ${label}`,
    none: "Aucune image",
  },
} as const;
