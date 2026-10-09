import type { Capability } from "@kibo/schema";

export const frComponentsList = {
  title: "Composants",
  subtitle:
    "Les widgets et vues disponibles dans tes pages. Les composants intégrés viennent avec Kibo ; les autres sont à toi, créés par l'IA ou installés depuis une marketplace.",
  create: "Créer un composant",
  creations: (n: number) => `Créations (${n})`,
  search: "Rechercher un composant",
  trustLabel: "Confiance",
  originLabel: "Origine",
  trust: { all: "Tous", trusted: "Fiables", sandboxed: "Isolés", pending: "À examiner" },
  origin: { all: "Tous", kibo: "Kibo", user: "Les miens", ai: "Créés par l'IA", marketplace: "Marketplace" },
  clear: "Effacer les filtres",
  noMatch: "Aucun composant ne correspond.",
  sortBy: (column: string) => `Trier par ${column}`,
  usagesTitle: "Utilisé dans",
  usagesOf: (title: string, version: string) => `${title} ${version}`,
  usagesEmpty: "Ce composant n'est posé sur aucune page.",
  formats: (labels: readonly string[]) => `Formats : ${labels.join(", ")}`,
  capabilities: (labels: readonly string[]) => `Capacités : ${labels.join(", ")}`,
  capabilityLabels: {
    webgl: "3D",
    audio: "Son",
    fullscreen: "Plein écran",
    gamepad: "Manette",
    assets: "Fichiers du projet",
    design: "Maquettes",
    embed: "Cadre intégré",
  } satisfies Record<Capability, string>,
  place: (project: string, page: string) => `${project} › ${page}`,
};
