import type { DesignProvider } from "@kibo/schema";

const PROVIDERS = { figma: "Figma", penpot: "Penpot", storybook: "Storybook" } as const satisfies Record<
  DesignProvider,
  string
>;

export const fr = {
  title: "Maquette",
  empty: "Colle l'URL d'un cadre Figma ou d'un board Penpot dans les réglages du widget.",
  loading: "Chargement de la maquette…",
  retry: "Réessayer",
  stale: "Périmé",
  offline: "Hors ligne",
  refresh: "Actualiser",
  open: (provider: DesignProvider) => `Ouvrir dans ${PROVIDERS[provider]}`,
  provider: PROVIDERS,
  viewer: (name: string) => `Aperçu de ${name} : Ctrl ou ⌘ et molette pour zoomer, glisser pour déplacer`,
  zoom: { toolbar: "Zoom", in: "Zoom avant", out: "Zoom arrière", fit: "Ajuster" },
  nav: {
    group: "Cadres",
    prev: "Cadre précédent",
    next: "Cadre suivant",
    position: (i: number, n: number) => `${i} / ${n}`,
  },
  linked: "Tickets liés",
  noLinked: "Aucun ticket lié à ce cadre.",
  ticket: (key: string, title: string) => `${key} · ${title}`,
};
