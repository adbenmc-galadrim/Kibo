export const frProject = {
  files: "Fichiers du projet…",
  edit: {
    title: "Modifier le projet",
    name: "Nom",
    color: "Couleur",
    colorOption: (hex: string) => `Couleur ${hex}`,
    image: "Image",
    folder: "Dossier",
    folderHelp: "Le dossier reste sur ta machine. Vide pour délier.",
    worktree: "Worktrees des agents",
    worktreeBase: "Base",
    worktreePath: "Chemin",
    worktreeSetup: "Commande de préparation",
    worktreeHelp:
      "Variables : {branch} {slug} {key} ; {path} dans la commande. La commande s'exécute depuis la racine du dépôt, sur ta machine.",
    worktreeExample: "Exemple : origin/dev · ../emis-{slug} · pnpm worktree {branch}",
    worktreeErrors: {
      base: "La base doit être une branche (main) ou une branche distante (origin/dev).",
      path: "Le chemin doit rester dans le dépôt ou à côté de lui.",
      setup: "La commande fait 1000 caractères au plus.",
      setupVariables: "La commande n'accepte que les variables {branch} {slug} {key} {path}.",
    },
    save: "Enregistrer",
    cancel: "Annuler",
    folderBusy: "Un agent travaille sur ce projet : attends la fin de ses runs pour changer le dossier.",
    failed: "Impossible de modifier le projet.",
    errors: {
      INVALID_INPUT:
        "Le nom ne peut pas être vide et le dossier doit être un chemin absolu vers un dossier existant.",
      FORBIDDEN: "Ce projet est en lecture seule pour toi.",
      TOO_LARGE: "Image trop lourde : 256 kB au plus.",
      NOT_FOUND: "Ce projet n'existe plus.",
    },
  },
  remove: {
    title: (name: string) => `Supprimer le projet ${name} ?`,
    leaveTitle: (name: string) => `Quitter le projet ${name} ?`,
    summary: (tickets: number, pages: number, widgets: number) =>
      `${tickets} ticket${tickets > 1 ? "s" : ""}, ${pages} page${pages > 1 ? "s" : ""} et ${widgets} widget${widgets > 1 ? "s" : ""} seront supprimés.`,
    keepsFolder: "Le dossier",
    keepsAfter:
      "et ses fichiers ne sont pas touchés ; les notes restent sur le disque ; l'historique des runs est conservé.",
    keepsNoFolder: "Les notes restent sur le disque ; l'historique des runs est conservé.",
    leaveHelp:
      "Ta copie locale sera supprimée. Le projet reste sur le serveur : il te faudra une nouvelle invitation pour y revenir.",
    confirmLabel: (name: string) => `Tape ${name} pour confirmer`,
    confirm: "Supprimer",
    demoTitle: "Supprimer le projet de démonstration ?",
    demoHelp: "Ses tickets, ses pages et ses notes disparaissent. Tes autres projets ne sont pas touchés.",
    demoConfirm: "Supprimer la démo",
    leave: "Quitter le projet",
    cancel: "Annuler",
    busyTitle: "Des agents travaillent sur ce projet",
    busy: (n: number) =>
      `${n} run${n > 1 ? "s" : ""} en cours ou en file : arrête-les avant de supprimer le projet.`,
    seeAgents: "Voir les agents",
    sharedTitle: "Ce projet est partagé",
    sharedOwner:
      "Tu en es propriétaire : arrête d'abord le partage, ce qui le supprime du serveur pour tout le monde.",
    openShare: "Ouvrir le partage",
    failed: "Impossible de supprimer le projet.",
    errors: {
      CONFLICT:
        "Un run du projet est en cours, ou tu en es propriétaire alors qu'il est partagé : arrête les runs ou le partage d'abord.",
      FORBIDDEN: "Supprimer un projet n'est possible que depuis l'ordinateur où tourne Kibo.",
      NOT_FOUND: "Ce projet n'existe plus.",
    },
  },
} as const;
