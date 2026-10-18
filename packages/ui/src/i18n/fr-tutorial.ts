export const frTutorial = {
  panel: "Didacticiel",
  progress: (done: number, total: number) => `${done} sur ${total}`,
  collapse: "Replier le didacticiel",
  expand: "Déplier le didacticiel",
  goTo: "Aller à la page",
  skipStep: "Passer cette étape",
  pause: "Mettre en pause",
  stop: "Arrêter le didacticiel",
  close: "Fermer",
  read: "C'est lu",
  simulateReview: "Simuler la PR",
  copy: (command: string) => `Copier ${command}`,
  copyFailed: "Copie refusée par le navigateur. Réessaie.",
  doneTitle: "Bravo, tu as fait le tour de Kibo",
  doneText: "Tu peux supprimer le projet de démonstration : tes autres projets ne sont pas touchés.",
  deleteDemo: "Supprimer le projet de démo",
  stepDone: "fait",
  stepCurrent: "en cours",
  failed: "L'action n'a pas abouti. Réessaie.",
  offer: {
    title: "Faire le tour de Kibo ?",
    text: "Cinq étapes dans un projet de démonstration, environ cinq minutes. Aucun agent n'est lancé.",
    start: "Commencer",
    later: "Plus tard",
    resume: "Reprendre",
    restart: "Recommencer",
  },
  steps: {
    overview: {
      title: "Lire la Vue d'ensemble",
      instruction:
        "Le sprint courant, les fonctionnalités, la PR en review et la question bloquante : tout se lit ici, mis à jour depuis git et GitHub.",
    },
    feature: {
      title: "Créer une fonctionnalité",
      instruction: "Dans le Planning, clique sur « Fonctionnalité », donne-lui un titre et crée-la.",
    },
    review: {
      title: "Voir une étape passer en review",
      instruction:
        "Dans T3 Code, /full-delivery ouvre la PR et Kibo passe l'étape en review. Ici, le démon de démo simule la PR de DEMO-4 : regarde-la passer dans En review.",
    },
    question: {
      title: "Répondre à une question",
      instruction: "Sur la page Questions, réponds à la question bloquante du client : F3 est débloquée.",
    },
    copy: {
      title: "Copier /full-delivery",
      instruction:
        "Chaque étape se livre dans T3 Code avec /full-delivery et sa clé. Copie la commande, puis colle-la dans T3 Code.",
    },
  },
} as const;
