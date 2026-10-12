const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
const DESIGN_ROW = "Cadres liés aux tickets et widgets Maquette";

export const frIntegrationRows = {
  git: { title: "Git local", description: "Branches, commits, worktrees, diff" },
  github: {
    title: "GitHub",
    description: (login: string | null) =>
      login ? `PR, reviews, statuts CI · compte ${login}` : "PR, reviews, statuts CI",
  },
  "github-issues": {
    title: "GitHub Issues & Projects",
    description: "Synchronise les tickets d'un composant",
  },
  "github-actions": { title: "GitHub Actions", description: "Runs et logs liés à la PR et au ticket" },
  figma: {
    title: "Figma",
    description: (account: string | null) =>
      account ? `${DESIGN_ROW} · compte ${account}` : `${DESIGN_ROW} · serveur MCP`,
  },
  penpot: {
    title: "Penpot",
    description: (account: string | null) => (account ? `${DESIGN_ROW} · ${account}` : DESIGN_ROW),
  },
  notifications: {
    title: "Notifications système",
    description: "Agent en attente, run terminé, CI cassée",
  },
  markdown: { title: "Markdown / Obsidian", description: "Les notes restent des fichiers .md" },
  mcp: {
    title: "Serveurs MCP",
    description: (servers: string[]) =>
      servers.length === 0
        ? "Connecteur générique · aucun serveur"
        : `Connecteur générique · ${servers.length} ${plural(servers.length, "serveur", "serveurs")} (${servers.join(", ")})`,
  },
};
