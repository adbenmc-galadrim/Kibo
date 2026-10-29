export const frComponents = {
  instance: {
    menu: (title: string) => `Actions ${title}`,
    remove: "Retirer de la page…",
    settings: "Réglages…",
    removeTitle: (title: string) => `Retirer ${title} de la page ?`,
    removeHelp: "Le widget disparaît de la page ; les tickets ne sont pas touchés.",
    removeConfirm: "Retirer",
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
