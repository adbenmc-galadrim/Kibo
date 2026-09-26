import type { CatalogEntry } from "./ports";

export const BUILTIN_STARTERS: readonly CatalogEntry[] = [
  { id: "kanban", title: "Kanban", description: "Tickets par statut, glisser-déposer", kind: "both" },
  { id: "tickets", title: "Tickets", description: "Arbre des tickets, sous-tickets illimités", kind: "both" },
  {
    id: "graph",
    title: "Graphe de dépendances",
    description: "Généré depuis les liens bloque / bloqué par",
    kind: "both",
  },
  { id: "notes", title: "Notes", description: "Markdown local, compatible Obsidian", kind: "both" },
];
