const duration = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};

export const frT3 = {
  launch: "Lancer dans T3",
  open: "Ouvrir dans T3",
  running: (ms: number) => `T3 · en cours depuis ${duration(ms)}`,
  waiting: "T3 · attend ta réponse",
  missing: "T3 Code n'est pas installé",
  serverDown: "T3 Code n'est pas lancé · ouvre-le puis réessaie",
  noFolder: "Relie le dossier du projet",
  dialogTitle: (key: string) => `Lancer ${key} dans T3`,
  dialogHelp: "Kibo ouvre une session T3 Code qui livre l'étape avec /full-delivery.",
  project: "Projet T3",
  model: "Modèle",
  defaultModel: "par défaut",
  cancel: "Annuler",
  confirm: "Lancer",
  failed: (key: string, message: string) => `T3 n'a pas pu lancer ${key} · ${message}`,
};
