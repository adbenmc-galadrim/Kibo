export const frFileTools = {
  wrap: "Retour à la ligne",
  find: "Rechercher ou :ligne",
  openFind: (shortcut: string) => `Rechercher (${shortcut})`,
  count: (current: number, total: number) => `${current} / ${total}`,
  previous: "Occurrence précédente",
  next: "Occurrence suivante",
  closeFind: "Fermer la recherche",
  copyPath: "Copier le chemin",
  copied: "Chemin copié",
  copyFailed: "Impossible de copier le chemin.",
};
