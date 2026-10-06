import type { FrameProblemContext, FrameProblemKind } from "@kibo/schema";

export const frProblems: Record<FrameProblemKind, (ctx: FrameProblemContext) => string> = {
  notConnected: ({ name }) => `Connecte ${name} dans Paramètres › Intégrations.`,
  tokenRefused: ({ name }) => `${name} a refusé le jeton. Reconnecte ${name} dans Paramètres › Intégrations.`,
  otherInstance: ({ host }) => `Ce board est sur une autre instance Penpot (${host}) que celle connectée.`,
  notFound: ({ provider }) =>
    provider === "penpot"
      ? "Board introuvable : supprimé, ou le lien vise un autre fichier."
      : "Cadre introuvable : supprimé, ou ton compte n'y a pas accès.",
  noThumbnail: () => "Pas encore d'aperçu : ouvre ce fichier dans Penpot pour le générer, puis actualise.",
  unreachable: ({ name }) => `${name} ne répond pas. Vérifie ta connexion, ou que l'instance est démarrée.`,
  rateLimited: () => "Limite de requêtes atteinte. Réessaie dans une minute.",
  mcpClosed: () => "Ouvre l'application Figma (serveur MCP), puis actualise.",
  unavailable: ({ code }) => (code ? `Maquette indisponible (${code}).` : "Maquette indisponible."),
};
