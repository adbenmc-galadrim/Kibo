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
    invalid: "URL invalide : il faut un lien de cadre Figma (node-id) ou de board Penpot (board-id).",
    notConnected: "Connecte Figma ou Penpot dans Paramètres › Intégrations.",
    noThumbnail: "Aucun aperçu : ouvre le fichier dans Penpot pour le générer.",
    unavailable: "Aperçu indisponible",
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
};
