export const frShell = {
  palette: {
    projectAgent: "Agent de projet",
    copy: (command: string) => `Copier ${command}`,
    newFeature: "Nouvelle fonctionnalité",
    newSprint: "Nouveau sprint",
    newQuestion: "Nouvelle question",
    sprint: (code: string, name: string) => `${code} · ${name}`,
  },
  notFound: {
    title: "Introuvable",
    project: "Ce projet n'existe pas ou a été supprimé.",
    ticket: "Ce ticket n'existe pas ou a été supprimé.",
    home: "Retour à l'Accueil",
  },
  pageError: {
    title: "Cette page a rencontré une erreur",
    detail: "Le reste de Kibo fonctionne. Réessaie, ou rouvre la page plus tard.",
    retry: "Réessayer",
  },
};
