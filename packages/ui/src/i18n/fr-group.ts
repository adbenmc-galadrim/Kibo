export const frGroup = {
  kicker: (key: string) => `Ensemble · ${key}`,
  state: "État",
  derived: "dérivé des sous-tickets",
  progress: "Avancement",
  delivered: (done: number, total: number) => `${done}/${total} livrés`,
  children: "Sous-tickets",
};
