const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const frReport = {
  title: "Signaler un problème",
  description:
    "Voici le rapport que Kibo a préparé. Relis-le : il ne contient ni jeton, ni secret, ni contenu de tes projets. Copie-le, puis colle-le dans l'issue GitHub.",
  loading: "Préparation du rapport…",
  failed: (message: string) => `Le rapport n'a pas pu être préparé : ${message}`,
  localOnly: "il ne se prépare que sur l'ordinateur où tourne Kibo.",
  includeLog: "Inclure le journal",
  copy: "Copier",
  copied: "Copié",
  copyFailed: "Copie impossible",
  openIssue: "Ouvrir une issue GitHub",
  close: "Fermer",
  reportLabel: "Rapport",
  heading: "# Rapport Kibo",
  version: (version: string) => `Kibo ${version}`,
  sections: {
    app: "## Application",
    environment: "## Environnement",
    counts: "## Contenu",
    integrations: "## Intégrations",
    log: "## Journal (50 dernières lignes)",
  },
  daemon: (pid: number, home: string, uptime: string) =>
    `Démon : PID ${pid} · ${home} · en marche depuis ${uptime}`,
  claude: (version: string | null, loggedIn: boolean | null) =>
    [
      `claude ${version ?? "présent"}`,
      loggedIn === true ? "connecté" : loggedIn === false ? "non connecté" : null,
    ]
      .filter((x) => x !== null)
      .join(" · "),
  claudeMissing: "claude introuvable",
  tool: (name: string, version: string | null) => `${name} ${version ?? "introuvable"}`,
  capacity: (cores: number, ramGb: number, slots: number) =>
    `${plural(cores, "cœur", "cœurs")} · ${ramGb} Go de mémoire · ${plural(slots, "créneau", "créneaux")}`,
  counts: (c: {
    projects: number;
    tickets: number;
    components: number;
    instances: number;
    profiles: number;
  }) =>
    [
      plural(c.projects, "projet", "projets"),
      plural(c.tickets, "ticket", "tickets"),
      plural(c.components, "composant", "composants"),
      plural(c.instances, "instance", "instances"),
      plural(c.profiles, "profil", "profils"),
    ].join(" · "),
  noIntegration: "aucune",
  emptyLog: "(vide)",
  issueTitle: "Problème : ",
} as const;
