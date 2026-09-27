export const frComponents = {
  addComponent: {
    title: "Ajouter un composant",
    search: "Rechercher un composant…",
    builtin: "Intégrés",
    mine: "Mes composants",
    draft: "Brouillon",
    publish: "Publier",
    create: "Créer un composant (code ou IA)",
    noResult: "Aucun composant ne correspond.",
    pick: "Choisis un composant pour voir ce qu'il lit et modifie.",
    display: "Affichage",
    widget: "Widget dans la grille",
    view: "Vue plein écran",
    builtinTrust: (reads: readonly string[], writes: readonly string[]) => {
      const same = reads.length > 0 && reads.join() === writes.join();
      if (same) return `Intégré · confiance totale · lit et écrit : ${reads.join(", ")}`;
      return `Intégré · confiance totale · lit : ${reads.join(", ") || "rien"}${
        writes.length ? ` · écrit : ${writes.join(", ")}` : ""
      }`;
    },
    mineLine: (origin: string, trust: string, hosts: readonly string[]) =>
      [origin, trust, ...hosts].join(" · "),
    pendingTrust: "Autorisation requise",
    submit: "Ajouter à la page",
    failed: "Impossible d'ajouter le composant.",
    loadFailed: "Impossible de charger tes composants.",
  },
  components: {
    title: "Composants",
    column: {
      name: "Composant",
      version: "Version",
      trust: "Confiance",
      origin: "Origine",
      usedIn: "Utilisé dans",
    },
    trust: {
      builtin: "Intégré",
      trusted: "Confiance totale",
      sandboxed: "Sandboxé",
      pending: "Autorisation requise",
    },
    origin: { kibo: "Kibo", user: "Toi", ai: "IA", marketplace: "Marketplace" },
    usage: (pages: number, projects: number) =>
      pages === 0
        ? "Aucune page"
        : `${pages} page${pages > 1 ? "s" : ""} · ${projects} projet${projects > 1 ? "s" : ""}`,
    actions: (title: string, version: string) => `Actions ${title} ${version}`,
    review: "Examiner",
    rehash: "Revérifier l'empreinte",
    revoke: "Retirer la confiance",
    uninstall: "Désinstaller",
    uninstallBlocked: "Utilisé sur des pages : retire d'abord ses instances.",
    rehashOk: "Empreinte vérifiée.",
    rehashChanged: "L'empreinte a changé : la confiance est redemandée.",
    drafts: "Brouillons",
    draftValidated: "Tests verts",
    draftPending: (id: string) => `À valider : kibo component test ${id}`,
    publish: "Publier",
    empty: "Aucun composant installé en dehors des intégrés.",
    failed: "Impossible de charger les composants.",
    actionFailed: "L'action a échoué.",
    loading: "Chargement…",
  },
  publish: {
    title: (name: string, version: string) => `Publier « ${name} » ${version}`,
    subtitle: "Ce composant est utilisé ailleurs. Choisis comment appliquer la modification.",
    usedIn: (projects: number) => `Utilisé dans ${projects} projet${projects > 1 ? "s" : ""}`,
    updateOne: "Mettre à jour",
    keep: "Inchangée",
    loading: "Validation en cours…",
    changes: "Changements",
    permission: (p: string) => `Permission ${p}`,
    migration: (from: number, to: number) => `Migration de config v${from} → v${to} (automatique)`,
    updateAll: "Mettre à jour partout",
    updateAllHelp: (n: number, version: string, asks: boolean) =>
      `${n > 1 ? `Les ${n} instances passent` : "L'instance passe"} en ${version}.${
        asks ? " La nouvelle permission sera demandée une seule fois." : ""
      }`,
    newVersion: "Créer une nouvelle version",
    newVersionHelp: (from: string) =>
      `Les instances existantes restent en ${from} ; tu les mets à jour une par une depuis leur page.`,
    submit: (version: string) => `Publier ${version}`,
    unchanged: "Rien à publier : cette version est déjà publiée avec le même code.",
    versionExists:
      "Cette version existe déjà avec un autre code. Change la version dans kibo.component.json.",
    versionTooLow: "La version doit être plus haute que la dernière publiée.",
    invalid: (id: string) =>
      `La validation a échoué : corrige le composant puis lance kibo component test ${id}.`,
    partial: (n: number) =>
      `${n} instance${n > 1 ? "s n'ont" : " n'a"} pas pu être migrée${n > 1 ? "s" : ""} et reste${
        n > 1 ? "nt" : ""
      } sur l'ancienne version.`,
    done: (version: string) => `Version ${version} publiée.`,
    failed: "Impossible de publier le composant.",
  },
  trust: {
    title: (name: string, version: string) => `Autoriser « ${name} » ${version} ?`,
    subtitle: (origin: string, hash: string) =>
      `${origin} · empreinte sha256 ${hash} · vérifiée par le démon`,
    origin: {
      kibo: "Composant Kibo",
      user: "Composant écrit par toi",
      ai: "Composant généré par IA",
      marketplace: "Composant de la marketplace",
    },
    asks: "Il demande :",
    readTickets: "Lire les tickets du projet",
    readNotes: "Lire les notes du projet",
    readData: "Lire les données du projet",
    writeData: "Modifier les données du projet",
    entities: (list: string) => `entités : ${list}`,
    entityName: (entity: string) => (entity === "ci_run" ? "runs CI" : entity),
    ownData: "Stocker ses propres données",
    ownDataHelp: "espace de nommage de l'instance uniquement",
    network: "Accéder au réseau",
    networkHelp: (rules: string) => `HTTPS via le démon uniquement : ${rules}`,
    noNetworkNoFiles: "Aucun accès réseau, aucun fichier local",
    noNetwork: "Aucun accès réseau",
    noFiles: "Aucun fichier local",
    level: "Niveau de confiance",
    sandboxed: "Sandboxé (recommandé)",
    sandboxedHelp:
      "Interface dans une iframe isolée, backend dans un processus séparé confiné par l'OS : ni réseau direct, ni accès à tes fichiers. Le démon vérifie chaque appel contre les permissions ci-dessus.",
    trusted: "Confiance totale",
    trustedHelp:
      "Chargé dans l'app et exécuté dans le démon, comme les intégrés : rien ne l'empêche de dépasser les permissions ci-dessus. À réserver au code que tu as écrit et relu.",
    footer: "Si le code du composant change, l'empreinte change : Kibo redemande ton accord.",
    refuse: "Refuser",
    approve: "Autoriser",
    approveAndAdd: "Autoriser et ajouter",
    hashMismatch: "Le code a changé depuis l'ouverture de cette fenêtre : vérifie la nouvelle empreinte.",
    failed: "Impossible d'autoriser le composant.",
  },
  createComponent: {
    title: "Créer un composant",
    subtitle:
      "Même procédure pour tous : manifest kibo.component.json, SDK, suite de conformité, puis ajout à la page.",
    aiPlaceholder: "Burndown du sprint : tickets restants par jour, ligne idéale, filtre par domaine.",
    code: "Depuis le code",
    codeHelp: "Génère le squelette dans le dossier des composants du workspace :",
    codeFooter: "Le composant apparaît dans « Mes composants » dès que les tests passent.",
    copy: "Copier les commandes",
    copied: "Commandes copiées.",
  },
  instance: {
    menu: (title: string) => `Actions ${title}`,
    updateTo: (version: string) => `Mettre à jour vers ${version}`,
    notesDir: "Dossier des notes…",
    remove: "Retirer de la page",
    updated: (version: string) => `Instance mise à jour en ${version}.`,
    updateFailed: "Impossible de mettre à jour l'instance.",
    removeFailed: "Impossible de retirer le composant.",
    pendingTitle: "Autorisation requise",
    pendingHelp: (title: string, version: string) =>
      `« ${title} » ${version} doit être autorisé avant de s'afficher.`,
    pendingChanged: "Son code a changé depuis ton accord.",
    review: "Examiner et autoriser",
    loadFailed: "Impossible de charger le composant.",
    navigated:
      "Ce composant a tenté de quitter son bac à sable et a été arrêté. Recharge la page pour le relancer.",
  },
  notesDir: {
    title: "Dossier des notes",
    help: "Chemin absolu d'un dossier Markdown ou d'un vault Obsidian. Réglage propre à cette machine.",
    label: "Dossier",
    submit: "Enregistrer",
    failed: "Dossier introuvable ou illisible.",
  },
  openView: {
    title: (name: string) => `Créer une page ${name} ?`,
    help: "Aucune page Vue de ce projet ne contient ce composant.",
    submit: "Créer la page",
    failed: "Impossible de créer la page.",
  },
  cli: {
    title: "Commande kibo",
    help: "Installe la commande kibo dans ~/.local/bin pour créer, tester et publier tes composants.",
    install: "Installer la commande kibo",
    installed: (path: string) => `Installée : ${path}`,
    notInstalled: "Non installée",
    failed: "Impossible d'installer la commande kibo",
    cause: {
      PERMISSION_DENIED:
        "~/.local/bin n'est pas accessible en écriture. Crée le dossier ou corrige ses droits, puis réessaie.",
      CONFLICT: "~/.local/bin/kibo existe déjà et n'appartient pas à Kibo. Supprime-le, puis réessaie.",
      INVALID_INPUT: "La commande s'installe depuis l'application Kibo installée.",
      other: "Réessaie ; si l'échec persiste, consulte le journal du démon.",
    },
  },
  componentErrors: {
    HASH_MISMATCH: "Le code du composant a changé depuis son affichage : vérifie de nouveau son empreinte.",
    TRUST_REQUIRED: "Ce composant attend ton autorisation.",
    VERSION_EXISTS:
      "Cette version est déjà publiée avec un autre code : change la version dans kibo.component.json.",
    VALIDATION_FAILED: "La validation du composant a échoué.",
    MIGRATION_FAILED: "La migration de la configuration a échoué.",
    COMPONENT_CRASHED: "Le backend du composant s'est arrêté brutalement : il va redémarrer.",
    TIMEOUT: "Le composant n'a pas répondu à temps.",
    CONFLICT: "L'instance a changé entre-temps : réessaie.",
    RATE_LIMITED: "Ce composant fait trop d'appels : réessaie dans un instant.",
    QUOTA_EXCEEDED: "Ce composant a atteint sa limite de 256 Kio de données.",
    SANDBOX_UNAVAILABLE:
      "Aucun bac à sable système disponible : le backend de ce composant ne peut pas démarrer.",
    PERMISSION_DENIED: "Ce composant n'a pas la permission de faire cela.",
    FORBIDDEN: "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.",
  },
};
