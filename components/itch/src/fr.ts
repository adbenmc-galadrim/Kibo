import type { ItchEmbedProblem } from "./itch-embed";
import type { ItchProblemKind } from "./itch-problem";

export const fr = {
  title: "Jeu itch.io",
  frame: "Jeu itch.io",
  empty: "Colle le code d'intégration d'un jeu itch.io dans les réglages du widget.",
  loading: "Chargement du jeu…",
  retry: "Réessayer",
  fullscreen: "Plein écran",
  exitFullscreen: "Quitter le plein écran (Échap)",
  fullscreenHint: "Le bouton plein écran d'itch.io est sans effet ici : utilise « Plein écran ».",
  open: "Ouvrir sur itch.io",
  credit: "Fourni par itch.io",
  invalid: {
    empty: "Colle le code d'intégration d'un jeu itch.io dans les réglages du widget.",
    "page-url": "C'est l'adresse de la page du jeu ; il faut le code d'intégration (Partager › Intégrer).",
    "not-itch": "Ce n'est pas un code d'intégration itch.io : copie-le depuis Partager › Intégrer.",
    "upload-missing":
      "Ce lien itch.io n'est pas une intégration de jeu : il faut l'adresse https://itch.io/embed-upload/<id>.",
  } satisfies Record<ItchEmbedProblem, string>,
  problem: {
    offline: () => "Ce jeu a besoin d'Internet.",
    refused: () => "itch.io n'autorise pas l'intégration de ce jeu hors de son site. Ouvre-le sur itch.io.",
    notFound: () => "Jeu introuvable sur itch.io : vérifie le code d'intégration.",
    rateLimited: () => "Trop de tentatives, réessaie dans une minute.",
    unavailable: (code: string | null) => (code ? `Jeu indisponible (${code}).` : "Jeu indisponible."),
  } satisfies Record<ItchProblemKind, (code: string | null) => string>,
};
