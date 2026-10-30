export const fr = {
  pendingKey: "Clé attribuée à la prochaine synchronisation",
  selected: (count: number) => (count === 1 ? "1 sélectionné" : `${count} sélectionnés`),
  clearSelection: "Effacer la sélection",
  demo: (feature: string) => `Démo · ${feature}`,
  clientText: {
    blocks: (feature: string) => `bloque « ${feature} »`,
    for: (feature: string) => `pour « ${feature} »`,
    planned: (week: string) => `prévue semaine du ${week} · réponse souhaitée avant le ${week}`,
    unplanned: "à planifier",
  },
  group: {
    name: (key: string, title: string) => `${key} · ${title}`,
    open: (name: string) => `Ouvrir l'ensemble ${name}`,
  },
};
