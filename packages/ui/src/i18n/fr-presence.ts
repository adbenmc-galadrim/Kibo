export const frPresence = {
  label: "Personnes présentes",
  where: (name: string, place: string | null) => (place ? `${name} · ${place}` : name),
  watching: (name: string) => `${name} regarde ce ticket`,
  watchingPage: (names: string[]) =>
    names.length === 1 ? `${names[0]} regarde cette page` : `${names.length} personnes regardent cette page`,
  pendingKey: "Clé attribuée à la prochaine synchronisation",
};
