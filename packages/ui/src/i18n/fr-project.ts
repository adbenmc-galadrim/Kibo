export const frProject = {
  files: "Fichiers du projet…",
  menu: (name: string) => `Actions de ${name}`,
  edit: {
    title: "Modifier le projet",
    name: "Nom",
    color: "Couleur",
    description: "Description",
    descriptionHelp: "Une ligne, affichée sous le nom du projet dans la Vue d'ensemble.",
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
    worktreeExample: "Exemple : origin/dev · ../silo-{slug} · pnpm worktree {branch}",
    worktreeErrors: {
      base: "La base doit être une branche (main) ou une branche distante (origin/dev).",
      path: "Le chemin doit rester dans le dépôt ou à côté de lui.",
      setup: "La commande fait 1000 caractères au plus.",
      setupVariables: "La commande n'accepte que les variables {branch} {slug} {key} {path}.",
      setupQuoted:
        "Une variable entre guillemets simples ne serait pas remplacée : utilise des guillemets doubles.",
    },
    storybook: "Storybook",
    storybookOrigin: "Adresse",
    storybookOriginHelp: "Storybook local (pnpm storybook) ou déployé en https ; http seulement en local.",
    storybookPortEnv: "Variable du port dans .env des worktrees",
    storybookPortEnvHelp:
      "Chaque worktree qui définit cette variable dans .env ou .env.local apparaît comme un Storybook de sa branche.",
    storybookErrors: {
      origin: "Adresse refusée (https, ou http en local)",
      portEnv: "Nom de variable invalide",
    },
    guidelines: {
      title: "Guidelines",
      help: (name: string) =>
        `Les .md que reçoivent les agents des tickets de ${name}, après ceux du workspace.`,
      summary: (files: number, domains: number) =>
        `${files} fichier${files > 1 ? "s" : ""} .md · ${domains} domaine${domains > 1 ? "s" : ""}`,
      open: "Ouvrir le dossier de guidelines →",
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
  recipients: {
    title: "Destinataires des questions",
    help: "L'agent propose un destinataire en posant sa question ; tu le corriges d'un clic. Les questions s'exportent en texte.",
    byDefault: "par défaut",
    open: (n: number) =>
      n === 0 ? "aucune question ouverte" : `${n} question${n > 1 ? "s" : ""} ouverte${n > 1 ? "s" : ""}`,
    rename: (name: string) => `Renommer ${name}`,
    newName: (name: string) => `Nouveau nom de ${name}`,
    remove: (name: string) => `Supprimer ${name}`,
    add: "Ajouter",
    addLabel: "Nouveau destinataire",
    addPlaceholder: "Juridique, Design…",
    inUse: (n: number) => `Utilisé par ${n} question${n > 1 ? "s" : ""} ouverte${n > 1 ? "s" : ""}`,
    quota: "20 destinataires au plus.",
    failed: "Impossible de modifier les destinataires.",
  },
  remove: {
    title: (name: string) => `Supprimer le projet ${name} ?`,
    summary: (tickets: number, pages: number, widgets: number) =>
      `${tickets} ticket${tickets > 1 ? "s" : ""}, ${pages} page${pages > 1 ? "s" : ""} et ${widgets} widget${widgets > 1 ? "s" : ""} seront supprimés.`,
    keepsFolder: "Le dossier",
    keepsAfter:
      "et ses fichiers ne sont pas touchés ; les notes restent sur le disque ; l'historique des runs est conservé.",
    keepsNoFolder: "Les notes restent sur le disque ; l'historique des runs est conservé.",
    confirmLabel: (name: string) => `Tape ${name} pour confirmer`,
    confirm: "Supprimer",
    cancel: "Annuler",
    busyTitle: "Des agents travaillent sur ce projet",
    busy: (n: number) =>
      `${n} run${n > 1 ? "s" : ""} en cours ou en file : arrête-les avant de supprimer le projet.`,
    failed: "Impossible de supprimer le projet.",
    errors: {
      CONFLICT: "Un run du projet est en cours : arrête-le d'abord.",
      FORBIDDEN: "Supprimer un projet n'est possible que depuis l'ordinateur où tourne Kibo.",
      NOT_FOUND: "Ce projet n'existe plus.",
    },
  },
} as const;
