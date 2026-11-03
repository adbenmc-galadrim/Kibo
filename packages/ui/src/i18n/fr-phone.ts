const elapsed = (seconds: number): string => {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h`;
};

export const frPhone = {
  title: "Téléphone",
  subtitle: "Kibo sur ton téléphone, via kibo.shinseo.fr",
  access: {
    title: "Accès depuis le téléphone",
    description: "Le Mac se connecte au serveur ; aucun port n'est ouvert sur le Mac.",
    loading: "Lecture de l'accès…",
    unreadable: (detail: string) => `État illisible : ${detail}`,
    disabled: "Désactivé",
    connected: (sinceLastPush: number | null) =>
      sinceLastPush === null ? "Connecté" : `Connecté · dernier envoi il y a ${elapsed(sinceLastPush)}`,
    offline: "Hors ligne · reconnexion…",
    server: "Serveur",
    phone: "Téléphone",
    phonePaired: "Appairé",
    noPhone: "Aucun téléphone appairé",
  },
  enable: {
    serverUrl: "Adresse du serveur",
    setupCode: "Code d'installation",
    setupCodeHint: "Le code posé sur le serveur, saisi une seule fois.",
    submit: "Activer l'accès",
    busy: "Activation…",
    failed: (detail: string) => `L'activation a échoué : ${detail}`,
  },
  projects: {
    title: "Projets envoyés au téléphone",
    description: "Tous les projets sont désactivés au départ",
    loading: "Lecture des projets…",
    empty: "Aucun projet dans ce workspace.",
    failed: (detail: string) => `Le choix n'a pas été enregistré : ${detail}`,
  },
  pair: {
    open: "Appairer un téléphone",
    title: "Appairer un téléphone",
    description:
      "Scanne ce code depuis l'application Kibo sur ton téléphone, ou colle-le. Il expire dans 10 min.",
    qrLabel: "QR code d'appairage",
    qrFailed: "QR indisponible : colle le code.",
    loading: "Création du code…",
    failed: (detail: string) => `Le code n'a pas pu être créé : ${detail}`,
    expiresIn: "Expire dans",
    expired: "Code expiré",
    renew: "Nouveau code",
    copy: "Copier le code",
    copied: "Code copié",
    copyFailed: "Copie impossible : sélectionne le code.",
    close: "Fermer",
  },
  revoke: {
    open: "Révoquer le téléphone",
    title: "Révoquer le téléphone ?",
    description: "Le téléphone ne lira plus tes projets. Il faudra l'appairer à nouveau.",
    confirm: "Révoquer",
  },
  disable: {
    open: "Désactiver l'accès",
    title: "Désactiver l'accès ?",
    description: "Le Mac se déconnecte de kibo.shinseo.fr et le téléphone est révoqué.",
    confirm: "Désactiver",
  },
  cancel: "Annuler",
} as const;
