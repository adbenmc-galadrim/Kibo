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
  noLinkedStory: "Aucun ticket lié à une story.",
  ticket: (key: string, title: string) => `${key} · ${title}`,
  origins: {
    trigger: (label: string) => `Storybook : ${label}`,
    unreachable: "injoignable",
  },
  compare: {
    open: "Comparer",
    bar: "Comparaison",
    reference: (label: string) => `Référence : ${label}`,
    frame: (position: number, provider: string) => `Cadre ${position} (${provider})`,
    mode: "Mode de comparaison",
    side: "Côte à côte",
    overlay: "Superposition",
    top: (swapped: boolean) => (swapped ? "Story" : "Maquette"),
    opacity: (top: string, value: number) => `${top} ${value} %`,
    wipe: "Curseur de comparaison",
    wipeValue: (value: number) => `Curseur ${value} %`,
    swap: "Permuter",
    close: "Fermer la comparaison",
  },
};
