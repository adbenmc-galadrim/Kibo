const s = (n: number) => (n > 1 ? "s" : "");

export const fr = {
  lazy: { loading: "Chargement du graphe…", failed: "Impossible de charger le graphe.", retry: "Réessayer" },
  canvas: "Graphe des dépendances",
  hierarchical: "Hiérarchique",
  hierarchicalHelp: "Seule mise en page disponible pour l'instant",
  critical: "Chemin critique",
  hideDone: "Masquer terminés",
  filter: "Filtrer",
  assignee: "Assigné",
  mineAndAgents: "Moi + agents",
  all: "Tous",
  domain: "Domaine",
  allDomains: "Tous les domaines",
  summary: (n: number, blocked: number) =>
    `Chemin critique : ${n} ticket${s(n)} · ${blocked} bloqué${s(blocked)}`,
  widgetTitle: (n: number) => `Chemin critique · ${n} ticket${s(n)}`,
  blocked: (key: string, reason: string) =>
    `${key} bloqué : ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`,
  open: "Ouvrir le graphe →",
  legend: { blocks: "Bloque", critical: "Chemin critique", relates: "Lié à" },
  zoomIn: "Zoom avant",
  zoomOut: "Zoom arrière",
  zoomReset: "Taille réelle",
  fitAll: "Tout voir",
  minimap: "Vue d'ensemble du graphe",
  agent: "Assigné à un agent",
  emptyView: "Aucune dépendance entre les tickets affichés.",
  emptyWidget: "Aucun chemin critique : aucun ticket bloquant.",
  loadFailed: "Impossible de charger les tickets.",
};
