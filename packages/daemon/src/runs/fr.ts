export const fr = {
  waiting: (label: string) => `${label} attend une réponse`,
  done: (label: string) => `${label} a terminé`,
  failed: (label: string) => `${label} a échoué`,
  batchTitle: "Lot à valider",
  batchBody: (projectName: string, seq: number) => `Agent de projet · ${projectName} : lot n° ${seq}`,
};
