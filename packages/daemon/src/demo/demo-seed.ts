import type { Layout, StatusId } from "@kibo/schema";

export type DemoTicket = {
  ref: string;
  title: string;
  status: StatusId;
  parent?: string;
  blockedReason?: string;
  description: string;
};
export type DemoLink = { from: string; to: string; type: "blocks" | "relates" };
export type DemoComponentId = "kanban" | "tickets" | "notes" | "graph";
export type DemoPage = {
  title: string;
  kind: "dashboard" | "view";
  components: readonly { id: DemoComponentId; layout?: Layout }[];
};

export const DEMO_COMPONENT_VERSION = "1.0.0";

export const DEMO_TICKETS: readonly DemoTicket[] = [
  {
    ref: "DEMO-1",
    title: "Noyau de données",
    status: "in_progress",
    description: "Le modèle de données partagé par tous les composants.",
  },
  {
    ref: "DEMO-2",
    title: "Schéma des tickets",
    status: "in_progress",
    parent: "DEMO-1",
    description: "Décrire un ticket, ses statuts et ses sous-tickets.",
  },
  {
    ref: "DEMO-3",
    title: "Snapshots ↔ SQLite",
    status: "done",
    parent: "DEMO-1",
    description: "Enregistrer chaque projet sur le disque et le recharger au démarrage.",
  },
  {
    ref: "DEMO-4",
    title: "Monorepo",
    status: "done",
    description: "Un dépôt, plusieurs paquets, une seule commande de test.",
  },
  {
    ref: "DEMO-5",
    title: "Thème sombre",
    status: "in_review",
    description: "Chaque écran existe en sombre et en clair.",
  },
  {
    ref: "DEMO-6",
    title: "Kanban : glisser-déposer",
    status: "todo",
    description: "Déplacer un ticket d'une colonne à l'autre change son statut.",
  },
  {
    ref: "DEMO-7",
    title: "Coque et sidecar",
    status: "todo",
    description: "L'application de bureau lance le démon en arrière-plan.",
  },
  {
    ref: "DEMO-8",
    title: "Bac à sable des composants",
    status: "blocked",
    blockedReason: "Audit en attente",
    description: "Isoler chaque composant dans son propre cadre.",
  },
];

export const DEMO_LINKS: readonly DemoLink[] = [
  { from: "DEMO-4", to: "DEMO-2", type: "blocks" },
  { from: "DEMO-2", to: "DEMO-6", type: "blocks" },
];

export const DEMO_NOTE = {
  path: "bienvenue.md",
  markdown:
    "# Bienvenue dans la démo\n\nCe projet sert au didacticiel. Modifie cette note avec la barre d'outils : mets un mot en **gras**, ajoute une liste.\n",
} as const;

export const DEMO_PAGES: readonly DemoPage[] = [
  {
    title: "Tableau de bord",
    kind: "dashboard",
    components: [
      { id: "kanban", layout: { x: 0, y: 0, w: 8, h: 6 } },
      { id: "tickets", layout: { x: 8, y: 0, w: 4, h: 6 } },
      { id: "notes", layout: { x: 0, y: 6, w: 12, h: 4 } },
    ],
  },
  { title: "Kanban", kind: "view", components: [{ id: "kanban" }] },
  { title: "Graphe", kind: "view", components: [{ id: "graph" }] },
  { title: "Notes", kind: "view", components: [{ id: "notes" }] },
];
