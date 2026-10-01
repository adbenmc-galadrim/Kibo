export const frStartup = {
  unreachable: {
    title: "Kibo ne répond pas",
    explain: "Kibo n'est pas lancé, ou il ne répond pas à cette adresse.",
    inApp: "Relance Kibo.",
    inBrowser: "Vérifie que Kibo tourne sur l'ordinateur, puis réessaie.",
    failed: "Kibo n'a pas pu s'ouvrir",
    retry: "Réessayer",
    nextRetry: (seconds: number) => `Nouvelle tentative dans ${seconds} s…`,
  },
} as const;
