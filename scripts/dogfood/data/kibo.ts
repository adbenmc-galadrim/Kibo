import type { DesiredPage, DesiredProject, ProfileSettings } from "../src/desired";

export const PROJECT: DesiredProject = { name: "Kibo", key: "KIB", color: "#6366F1" };

export const NOTES_SUBDIR = "docs";

const view = (title: string, componentId: string): DesiredPage => ({
  title,
  kind: "view",
  instances: [{ componentId, config: {} }],
});

export const PAGES: DesiredPage[] = [
  {
    title: "Tableau de bord",
    kind: "dashboard",
    instances: [
      { componentId: "kanban", config: {}, layout: { x: 0, y: 0, w: 6, h: 6 } },
      { componentId: "tickets", config: { filter: "mine" }, layout: { x: 6, y: 0, w: 6, h: 6 } },
      { componentId: "graph", config: {}, layout: { x: 0, y: 6, w: 6, h: 6 } },
    ],
  },
  view("Kanban", "kanban"),
  view("Tickets", "tickets"),
  view("Graphe", "graph"),
  view("Notes", "notes"),
];

export const DOMAINS: { name: string; file: string }[] = [
  { name: "Sync", file: "sync.md" },
  { name: "Marketplace", file: "marketplace.md" },
  { name: "UI", file: "ui.md" },
  { name: "Démon", file: "demon.md" },
  { name: "Sécurité", file: "securite.md" },
  { name: "Devkit et SDK", file: "devkit-sdk.md" },
  { name: "Desktop", file: "desktop.md" },
  { name: "Agents", file: "agents.md" },
  { name: "CI", file: "ci.md" },
];

export const GUIDELINE_PATHS = {
  workspace: "conventions.md",
  project: "kibo.md",
  profile: "consignes.md",
} as const;

export const AGENT_SETTINGS: Record<string, ProfileSettings> = {
  "kibo-lead": { permissionMode: "default", workspace: "worktree", maxParallel: 1 },
  "kibo-dev": { permissionMode: "acceptEdits", workspace: "worktree", maxParallel: 2 },
  "kibo-reviewer": { permissionMode: "plan", workspace: "worktree", maxParallel: 2 },
  "kibo-runner": { permissionMode: "acceptEdits", workspace: "worktree", maxParallel: 2 },
};
