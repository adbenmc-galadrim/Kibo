const s = (n: number) => (n > 1 ? "s" : "");

export const frChanges = {
  changes: {
    title: "Changements",
    worktree: (branch: string) => `worktree ${branch}`,
    staged: "Dans le prochain commit",
    unstaged: "Modifications",
    section: (title: string, n: number) => `${title} (${n})`,
    files: (n: number) => `Fichiers (${n})`,
    stageHunk: "Ajouter le bloc au commit",
    viewMode: "Affichage du diff",
    unified: "Unifié",
    split: "Côte à côte",
    edit: "Édition",
    openExternal: "Ouvrir dans l'éditeur externe",
    binary: "Fichier binaire : aucun diff à afficher.",
    clean: "Aucun changement dans ce worktree.",
    branch: (n: number, additions: number, deletions: number, base: string) =>
      `Branche · ${n} fichier${s(n)} · +${additions} −${deletions} depuis ${base}`,
    loading: "Chargement des changements…",
    save: "Enregistrer",
    saving: "Enregistrement…",
    reload: "Recharger",
    operation: (op: string) =>
      `${op} en cours : résous les conflits dans ton éditeur ou abandonne l'opération.`,
    localOnly:
      "Depuis un autre appareil, tu peux lire les changements mais pas les modifier : ajouter au commit, commiter et pousser se font sur l'ordinateur où tourne Kibo.",
    kind: {
      modified: "Modifié",
      added: "Ajouté",
      deleted: "Supprimé",
      renamed: "Renommé",
    },
    openInTab: "Ouvrir dans un onglet",
    copyPath: "Copier le chemin",
    copied: "Chemin copié",
    copyFailed: "Impossible de copier le chemin.",
    stageAll: "Tout ajouter",
    unstageAll: "Tout retirer",
  },
  commit: {
    title: "Commit",
    message: "Message",
    placeholder: "Message du commit",
    prefilled: "Pré-rempli depuis le ticket · 0 token",
    submit: (branch: string) => `Commit sur ${branch}`,
    modify: "Modifier",
    reword: "Reformuler",
    undo: "Annuler",
    pushed: "Poussé · ne peut plus être modifié",
    push: "Pousser",
    details: "Détails",
    elapsed: (seconds: number) => `${seconds} s`,
    prCard: (n: number, state: string) => `PR #${n} ${state}`,
    retry: "Réessayer",
  },
  pr: {
    title: "Pousser et créer la PR",
    subtitle: (branch: string, base: string, commits: number, files: number | null) =>
      `${branch} → ${base} · ${commits} commit${s(commits)} non poussé${s(commits)}${files === null ? "" : ` · ${files} fichier${s(files)}`}`,
    prTitle: "Titre",
    description: "Description",
    base: "Branche de base",
    staged: (n: number) =>
      n > 1
        ? `${n} fichiers ajoutés au commit ne sont pas encore commités : ils ne seront pas dans la PR.`
        : "1 fichier ajouté au commit n'est pas encore commité : il ne sera pas dans la PR.",
    draft: "Brouillon (draft)",
    link: (key: string) => `Lier la PR à ${key}`,
    submit: "Créer la PR",
    creating: "Création…",
    created: (n: number) => `PR #${n} créée`,
    review: (agent: string) => `Lancer ${agent} sur la PR`,
    rule: (key: string) => `À l'ouverture de la PR, ${key} passe en « En review » (règle du workflow).`,
  },
} as const;
