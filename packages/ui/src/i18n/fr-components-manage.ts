export const frComponentsManage = {
  addComponent: {
    title: "Ajouter un composant",
    search: "Rechercher un composant…",
    listLabel: "Composants disponibles",
    detailsLabel: "Description du composant",
    builtin: "Intégrés",
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
    submit: "Ajouter à la page",
    failed: "Impossible d'ajouter le composant.",
  },
  trust: {
    entityName: (entity: string) => (entity === "ci_run" ? "runs CI" : entity),
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
};
