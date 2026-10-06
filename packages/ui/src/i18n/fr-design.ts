import type { DesignUrlProblem, FrameProblemContext, FrameProblemKind } from "@kibo/schema";

export const frDesign = {
  connect: {
    figma: {
      title: "Connecter Figma",
      subtitle:
        "Kibo rend les cadres liés aux tickets et aux widgets Maquette, avec ton compte, et les garde en cache sur cette machine.",
      token: "Jeton personnel",
      tokenRecommended: "Recommandé",
      tokenLabel: "Jeton",
      tokenPlaceholder: "figd_…",
      tokenHelp:
        "Figma › Settings › Security › Personal access tokens. Portées : current_user:read et file_content:read. Le jeton reste dans le trousseau système.",
      mcp: "Serveur MCP de l'application Figma",
      url: "Adresse du serveur",
      urlHelp:
        "Active « Dev Mode MCP Server » dans les préférences de Figma, puis garde l'application ouverte.",
      defaultUrl: "http://127.0.0.1:3845/mcp",
      expectedTools: "get_metadata, get_screenshot",
      missingTools: {
        title: "Ce serveur n'expose pas les outils Figma attendus",
        detail: (tools: string) => `Outils manquants : ${tools}. Mets Figma à jour.`,
      },
      unreachable: {
        title: "Serveur Figma injoignable",
        detail: (address: string) =>
          `Rien n'écoute sur ${address}. Vérifie que Figma est lancé et que le serveur MCP est activé.`,
      },
      unreachableToken: {
        title: "Figma injoignable",
        detail: (address: string) =>
          `Impossible de joindre ${address}. Vérifie ta connexion internet, puis réessaie.`,
      },
      connected: (handle: string) => `Connecté en tant que ${handle}`,
      connectedMcp: "Serveur MCP connecté",
    },
    penpot: {
      title: "Connecter Penpot",
      subtitle:
        "Kibo lit les boards de tes fichiers Penpot et affiche leur aperçu dans les tickets et les widgets Maquette.",
      url: "Adresse de l'instance",
      urlHelp:
        "Ton instance auto-hébergée fonctionne aussi ; http seulement en local (127.0.0.1 ou localhost).",
      defaultUrl: "https://design.penpot.app",
      tokenLabel: "Jeton d'accès",
      tokenPlaceholder: "Jeton créé dans Penpot",
      tokenHelp:
        "Penpot › Compte › Jetons d'accès › Générer un nouveau jeton. Il reste dans le trousseau système.",
      unreachable: {
        title: "Instance injoignable",
        detail: (address: string) =>
          `Rien ne répond sur ${address}. Vérifie l'adresse et que l'instance est démarrée.`,
      },
      connected: (name: string) => `Connecté en tant que ${name}`,
      steps: {
        title: "Comment faire",
        token:
          "Dans Penpot, ouvre le menu de ton avatar › Profil › Jetons d'accès, génère un jeton et copie-le.",
        url: "Colle l'adresse de l'instance (https://design.penpot.app, ou l'origine de la tienne), pas celle d'un fichier.",
        selfHosted:
          "Instance auto-hébergée : les jetons d'accès sont désactivés par défaut. Ajoute enable-access-tokens à PENPOT_FLAGS (frontend et backend) et redémarre Penpot, sinon la section « Jetons d'accès » n'existe pas.",
        docs: "Documentation Penpot",
        docsUrl: "https://help.penpot.app/technical-guide/configuration/",
      },
      tokenIgnored: {
        title: "Penpot a ignoré ce jeton",
        detail:
          "Les jetons d'accès sont désactivés sur cette instance. Ajoute enable-access-tokens à PENPOT_FLAGS, redémarre Penpot, puis crée un jeton dans Profil › Jetons d'accès.",
      },
    },
    refused: { title: "Jeton refusé", detail: "Vérifie le jeton et ses portées, puis réessaie." },
    invalidUrl: { title: "Adresse invalide", detail: "https obligatoire, sauf 127.0.0.1 ou localhost." },
    submit: "Connecter",
    verifying: "Vérification…",
  },
  sheet: {
    mockups: "Maquettes",
    mockupProperty: "Maquette",
    link: "Lier un cadre",
    placeholder: "Colle l'URL d'un cadre Figma ou d'un board Penpot",
    unlink: "Retirer",
    refresh: "Actualiser",
    open: (provider: "figma" | "penpot") =>
      provider === "figma" ? "Ouvrir dans Figma" : "Ouvrir dans Penpot",
  },
  field: {
    placeholder: "https://www.figma.com/design/…?node-id=… ou https://design.penpot.app/#/workspace/…",
    invalid: "URL de cadre invalide : lien Figma (node-id) ou Penpot (board-id) attendu.",
  },
  badges: { stale: "Périmé", offline: "Hors ligne" },
  provider: { figma: "Figma", penpot: "Penpot" },
  retry: "Réessayer",
  urlProblems: {
    "not-a-url": "Ce n'est pas une adresse web.",
    credentials: "Retire l'identifiant et le mot de passe de l'adresse.",
    "unknown-site": "Lien Figma (figma.com) ou Penpot (design.penpot.app ou ton instance) attendu.",
    "figma-node-missing": "Sélectionne un cadre dans Figma puis copie le lien : il doit contenir node-id.",
    "penpot-insecure": "Une instance Penpot en http n'est acceptée qu'en local (127.0.0.1 ou localhost).",
    "penpot-file-missing": "Ouvre un fichier Penpot et sélectionne un board, puis copie l'adresse.",
    "penpot-page-missing": "L'adresse ne contient pas page-id : ouvre une page du fichier dans Penpot.",
    "penpot-board-missing":
      "Sélectionne un board dans Penpot avant de copier l'adresse : il manque board-id.",
  } satisfies Record<DesignUrlProblem, string>,
  problems: {
    notConnected: ({ name }) => `Connecte ${name} dans Paramètres › Intégrations.`,
    tokenRefused: ({ name }) =>
      `${name} a refusé le jeton. Reconnecte ${name} dans Paramètres › Intégrations.`,
    otherInstance: ({ host }) => `Ce board est sur une autre instance Penpot (${host}) que celle connectée.`,
    notFound: ({ provider }) =>
      provider === "penpot"
        ? "Board introuvable : supprimé, ou le lien vise un autre fichier."
        : "Cadre introuvable : supprimé, ou ton compte n'y a pas accès.",
    noThumbnail: () => "Pas encore d'aperçu : ouvre ce fichier dans Penpot pour le générer, puis actualise.",
    unreachable: ({ name }) => `${name} ne répond pas. Vérifie ta connexion, ou que l'instance est démarrée.`,
    rateLimited: () => "Limite de requêtes atteinte. Réessaie dans une minute.",
    mcpClosed: () => "Ouvre l'application Figma (serveur MCP), puis actualise.",
    unavailable: ({ code }) => `Maquette indisponible (${code}).`,
  } satisfies Record<FrameProblemKind, (ctx: FrameProblemContext) => string>,
};
