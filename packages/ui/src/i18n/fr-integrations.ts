const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const frIntegrations = {
  nav: "Intégrations",
  title: "Intégrations",
  subtitle: "Les secrets sont stockés dans le trousseau système, jamais dans les données du projet.",
  keychainUnavailable:
    "Trousseau système indisponible : déverrouille-le (Secret Service sur Linux) puis réessaie. Kibo ne stocke jamais de secret en clair.",
  rows: {
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
    figma: { title: "Figma (MCP)", description: "Nœuds Figma liés aux tickets, aperçus" },
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
  },
  state: {
    active: "Actif",
    connected: "Connecté",
    connect: "Connecter",
    error: "Erreur",
    retry: "Réessayer",
    rateLimited: (time: string) => `Limite GitHub atteinte, reprise à ${time}`,
  },
  menu: {
    label: (title: string) => `Actions pour ${title}`,
    configure: "Configurer",
    test: "Tester la connexion",
    disconnect: "Déconnecter",
    tested: "Connexion vérifiée",
  },
  disconnect: {
    title: (title: string) => `Déconnecter ${title} ?`,
    githubToken:
      "Le jeton est supprimé du trousseau. GitHub Issues & Projects et GitHub Actions sont aussi déconnectés ; les tickets déjà importés restent.",
    githubGh: "Kibo cesse d'utiliser ton compte gh. gh reste connecté sur ta machine.",
    figma: "Les liens vers les nœuds restent, les aperçus en cache aussi.",
    confirm: "Déconnecter",
  },
  github: {
    title: "Connecter GitHub",
    subtitle: "PR, reviews et statuts CI de tes projets. Le jeton reste dans le trousseau système.",
    gh: "Utiliser gh",
    ghRecommended: "Recommandé",
    ghDetected: (login: string) => `gh est connecté (${login})`,
    ghMissing: "gh n'est pas installé ou pas connecté (gh auth login).",
    token: "Jeton personnel",
    tokenLabel: "Jeton",
    tokenPlaceholder: "ghp_…",
    scopes:
      "Portées requises : repo, project (Projects v2). read:org si le Project appartient à une organisation. workflow n'est pas requis.",
    submit: "Connecter",
    verifying: "Vérification…",
    refused: "GitHub a refusé ce jeton.",
    connected: (login: string) => `Connecté en tant que ${login}`,
  },
  figma: {
    title: "Connecter Figma (MCP)",
    subtitle: "Kibo lit les nœuds Figma liés aux tickets via le serveur MCP de l'application Figma.",
    url: "Adresse du serveur",
    urlHelp:
      "Active « Dev Mode MCP Server » dans les préférences de Figma, puis garde l'application ouverte.",
    defaultUrl: "http://127.0.0.1:3845/mcp",
    submit: "Connecter",
    expectedTools: "get_metadata, get_screenshot",
    unreachable: {
      title: "Serveur Figma injoignable",
      detail: (address: string) =>
        `Rien n'écoute sur ${address}. Vérifie que Figma est lancé et que le serveur MCP est activé.`,
    },
    missingTools: {
      title: "Ce serveur n'expose pas les outils Figma attendus",
      detail: (tools: string) => `Outils manquants : ${tools}. Mets Figma à jour.`,
    },
    invalidUrl: { title: "Adresse invalide", detail: "https obligatoire, sauf 127.0.0.1." },
  },
  mcpServers: {
    title: "Serveurs MCP",
    subtitle: "Connecteurs génériques utilisables par les widgets Source MCP et par les agents.",
    add: "Ajouter un serveur",
    empty: "Aucun serveur MCP.",
    tools: (n: number) => (n === 0 ? "—" : `${n} ${plural(n, "outil", "outils")}`),
    enabled: "Activé",
    active: "Actif",
    disabled: "Désactivé",
    failed: "Erreur",
    remove: "Retirer",
    removeTitle: (name: string) => `Retirer ${name} ?`,
    removeHelp: "Les composants qui l'utilisent afficheront une erreur.",
    stdio: "stdio",
    http: "HTTP",
  },
  mcpServer: {
    title: "Ajouter un serveur MCP",
    subtitle: "Étape 1 sur 2 · Décris le serveur.",
    invalid: (field: string) => `${field} : valeur invalide.`,
    name: "Nom",
    id: "Identifiant",
    idTaken: "Identifiant déjà utilisé.",
    type: "Type",
    stdio: "Commande locale (stdio)",
    stdioHelp: "Kibo lance le processus",
    http: "Adresse HTTP",
    httpHelp: "Serveur déjà lancé",
    command: "Commande",
    args: "Arguments (un par ligne)",
    env: "Variables secrètes",
    envName: "Nom",
    envValue: "Valeur",
    envAdd: "Ajouter une variable",
    url: "Adresse",
    urlHelp: "https obligatoire, sauf 127.0.0.1.",
    bearer: "Jeton d'accès (facultatif)",
    next: "Continuer",
    confirmTitle: "Confirmer la commande",
    confirmStdio: "Étape 2 sur 2 · Kibo lancera exactement ceci, sans shell.",
    confirmHttp: "Étape 2 sur 2 · Kibo se connectera à cette adresse.",
    environment: (secrets: string[]) => {
      const names = ["PATH", "HOME", "LANG", ...secrets];
      const list = `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
      const origin =
        secrets.length === 0 ? "" : ` (${plural(secrets.length, "lu", "lues")} dans le trousseau)`;
      return `Environnement réduit : ${list}${origin}. Aucune autre variable n'est transmise.`;
    },
    warningTitle: "Ce processus aura les droits de ton utilisateur",
    warningBody: "N'ajoute qu'un serveur dont tu connais la source.",
    confirm: "Ajouter et lancer",
    back: "Retour",
  },
  source: {
    title: "Source",
    local: "Locale",
    localHelp: "Tickets du projet, dans Kibo uniquement.",
    synced: "Synchronisée · GitHub Issues",
    syncedHelp: "Aller-retour avec les issues d'un dépôt.",
    notConnected: "Connecte GitHub dans Paramètres › Intégrations pour synchroniser.",
    openSettings: "Ouvrir les intégrations",
    repo: "Dépôt",
    repoSearch: "Filtrer les dépôts…",
    repoEmpty: "Aucun dépôt.",
    project: "Project (facultatif)",
    noProject: "Aucun Project",
    statusMap: "Correspondance des statuts",
    statusMapHelp: "Pré-remplie par libellés identiques. Un statut sans correspondance n'est pas envoyé.",
    unmapped: "Non envoyé",
    labels: "Filtrer par libellés",
    labelsHelp: "Séparés par des virgules ; vide = toutes les issues.",
    importClosed: "Importer aussi les issues fermées",
    submit: "Ajouter et synchroniser",
    progress: (n: number) => `Synchronisation… ${n} ${plural(n, "issue importée", "issues importées")}`,
    done: (n: number) => `${n} ${plural(n, "issue importée", "issues importées")}`,
    failed: "La première synchronisation a échoué :",
  },
  sheet: {
    issue: (n: number) => `#${n}`,
    openOnGithub: "Ouvrir sur GitHub",
    pending: "Synchronisation en attente",
    pendingCreate: "Création de l'issue en attente",
    broken: "Lien GitHub rompu",
    brokenHelp: "L'issue a été supprimée ou transférée.",
    syncError: "Échec de synchronisation :",
    retry: "Réessayer",
    drop: "Abandonner",
    ci: "CI",
    ciEmpty: "Aucun run pour les PR de ce ticket.",
    viewLogs: "Voir les logs",
    logTitle: (job: string) => `Logs · ${job}`,
    logSearch: "Rechercher dans les logs",
    errorsOnly: "Erreurs seulement",
    logTruncated: "Log tronqué à 20 Mio.",
    logEmpty: "Aucune ligne.",
    conclusion: {
      success: "Réussi",
      failure: "Échec",
      cancelled: "Annulé",
      skipped: "Ignoré",
      timed_out: "Délai dépassé",
      action_required: "Action requise",
      neutral: "Neutre",
      running: "En cours",
      queued: "En file",
    },
    mockups: "Maquettes",
    mockupProperty: "Maquette",
    linkFigma: "Lier un nœud Figma",
    figmaPlaceholder: "Colle l'URL d'un nœud Figma (figma.com/design/…?node-id=…)",
    figmaInvalid: "URL Figma invalide : il faut un lien de nœud (node-id).",
    figmaUnreachable: "Figma non joignable",
    previewUnavailable: "Aperçu indisponible",
    unlink: "Retirer",
    figmaNotConnected: "Connecte Figma dans Paramètres › Intégrations.",
  },
  conflict: (key: string, field: "title" | "description" | "statusId") =>
    `Conflit résolu sur ${key} : ${{ title: "titre", description: "description", statusId: "statut" }[field]} repris de GitHub`,
  permissions: {
    secret: (name: string, hosts: string[]) =>
      name === "github"
        ? `Utiliser ton compte GitHub (${hosts.join(", ")})`
        : `Utiliser le secret ${name} (${hosts.join(", ")})`,
    mcp: (rule: string) => {
      const [server, tool] = rule.split("/");
      return tool ? `Appeler l'outil ${tool} du serveur MCP ${server}` : `Appeler le serveur MCP ${server}`;
    },
    mcpFromConfig: "Appeler le serveur MCP choisi à l'ajout",
  },
};
