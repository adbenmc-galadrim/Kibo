export const frUpdates = {
  title: "Mises à jour",
  help: "Kibo vérifie les nouvelles versions au lancement puis toutes les six heures. Rien ne s'installe sans ton accord.",
  browserOnly: "Les mises à jour se gèrent depuis l'application de bureau.",
  current: (version: string) => `Version installée : ${version}`,
  unknownVersion: "Version installée inconnue",
  check: "Rechercher",
  checking: "Vérification…",
  upToDate: "Kibo est à jour.",
  lastCheck: (time: string) => `Dernière vérification à ${time}`,
  available: (version: string) => `Version ${version} disponible`,
  published: (date: string) => `publiée le ${date}`,
  notes: "Notes de version",
  noNotes: "Aucune note pour cette version.",
  install: "Installer et redémarrer",
  backingUp: "Sauvegarde avant la mise à jour…",
  downloading: "Téléchargement…",
  downloaded: (percent: number) => `${percent} %`,
  installing: "Installation, Kibo va redémarrer…",
  blockedByRuns: (n: number) =>
    n > 1
      ? `${n} runs sont en cours : attends leur fin ou annule-les avant d'installer.`
      : "Un run est en cours : attends sa fin ou annule-le avant d'installer.",
  failed: "Mise à jour impossible",
  errors: {
    check: "Impossible de joindre GitHub. Vérifie la connexion, puis réessaie.",
    noRelease: "Aucune version publiée sur ce canal pour l'instant.",
    invalid:
      "La version publiée est invalide (format ou signature) : rien n'a été installé. Réessaie plus tard ou télécharge-la depuis la page des releases.",
    backup: "La sauvegarde a échoué : la mise à jour n'a pas été installée. Vérifie la carte Sauvegardes.",
    install:
      "L'installation a échoué ; l'application actuelle reste intacte. Réessaie ou télécharge la version depuis la page des releases.",
    appImageOnly:
      "Sur Linux, seule l'AppImage se met à jour toute seule : télécharge le paquet .deb ou .rpm depuis la page des releases.",
  },
  releases: "Page des releases",
} as const;
