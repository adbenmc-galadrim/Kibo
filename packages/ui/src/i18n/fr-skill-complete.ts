export const frSkillComplete = {
  list: "Skills",
  noMatch: "Aucun skill ne correspond.",
  noSkill: "Aucun skill autorisé pour cet agent.",
  user: "Cet ordinateur",
  project: "Projet",
  plugin: (name: string) => `Plugin · ${name}`,
  usage: (runs: number) => (runs === 0 ? "jamais utilisé" : `${runs} run${runs > 1 ? "s" : ""}/30 j`),
};
