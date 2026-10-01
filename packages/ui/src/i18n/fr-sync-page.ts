export const SYNC_DOCS_URL =
  "https://github.com/adbenmc-galadrim/Kibo/blob/main/docs/superpowers/specs/2026-09-26-kibo-sync.md";

export const frSyncPage = {
  purpose: "Partage tes projets entre tes appareils et avec ton équipe.",
  server: "Il te faut un serveur kibo-sync, hébergé par ton équipe.",
  docs: "Comment en installer un",
  connectTitle: "Se connecter à un serveur",
  connectHelp: "Avec l'adresse et le code reçus de l'administrateur.",
  connect: "Se connecter",
  deviceTitle: "C'est mon autre appareil",
  deviceHelp:
    "Sur l'appareil déjà connecté : Paramètres › Synchronisation › Appareils › Ajouter un appareil. Le code vaut 15 minutes.",
  enterCode: "Entrer le code",
  details: "Détails",
  revokeAction: "Révoquer…",
  revokeTitle: (device: string) => `Révoquer ${device} ?`,
  revokeBody: "Cet appareil ne pourra plus se connecter.",
  revokeConfirm: "Révoquer",
  open: "Ouvrir",
  manage: "Gérer le partage…",
  stop: "Arrêter le partage…",
  leave: "Quitter…",
  actions: (project: string) => `Actions pour ${project}`,
  serverAddress: "Adresse du serveur",
  addDeviceSteps: [
    "Sur l'autre appareil, ouvre Paramètres › Synchronisation.",
    "Choisis « C'est mon autre appareil ».",
    "Saisis l'adresse et ce code (15 minutes).",
  ],
} as const;
