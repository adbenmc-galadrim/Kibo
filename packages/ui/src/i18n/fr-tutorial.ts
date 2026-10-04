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
  doneTitle: "Bravo, tu as fait le tour de Kibo",
  doneText: "Tu peux supprimer le projet de démonstration : tes autres projets ne sont pas touchés.",
  deleteDemo: "Supprimer le projet de démo",
  stepDone: "fait",
  stepCurrent: "en cours",
  failed: "L'action n'a pas abouti. Réessaie.",
  offer: {
    title: "Faire le tour de Kibo ?",
    text: "Six étapes dans un projet de démonstration, environ dix minutes. L'agent de démonstration ne consomme aucun token.",
    start: "Commencer",
    later: "Plus tard",
    resume: "Reprendre",
    restart: "Recommencer",
  },
  steps: {
    kanban: {
      title: "Créer un ticket et le déplacer",
      instruction: "Sur la page Kanban, crée un ticket puis glisse-le dans la colonne En cours.",
    },
    links: {
      title: "Lier deux tickets",
      instruction:
        "Ouvre la fiche d'un ticket, ajoute une dépendance vers un autre ticket, puis ouvre la page Graphe pour la voir.",
    },
    note: {
      title: "Écrire une note",
      instruction:
        "Sur la page Notes, ouvre la note Bienvenue, clique sur Modifier et mets un mot en gras avec la barre d'outils.",
    },
    dashboard: {
      title: "Réorganiser le tableau de bord",
      instruction: "Sur le Tableau de bord, passe en mode édition puis déplace ou redimensionne un widget.",
    },
    agent: {
      title: "Confier un ticket à un agent",
      instruction:
        "Sur la page Kanban, ouvre un ticket ▸ Assigner à un agent ▸ Agent de démonstration. Réponds à sa question dans la barre des agents.",
    },
    component: {
      title: "Créer un composant",
      instruction:
        "Sur le Tableau de bord : Ajouter un composant ▸ Décrire à l'IA ▸ gabarit Graphique, puis ajoute-le à la page.",
    },
  },
} as const;
