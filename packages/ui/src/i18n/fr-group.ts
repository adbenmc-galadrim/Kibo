export const frGroup = {
  kicker: (key: string) => `Ensemble · ${key}`,
  state: "État",
  derived: "dérivé des sous-tickets",
  progress: "Avancement",
  delivered: (done: number, total: number) => `${done}/${total} livrés`,
  children: "Sous-tickets",
};

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export const frFeature = {
  kicker: (shortKey: string | null, key: string) =>
    ["Fonctionnalité", shortKey, key].filter((p) => p !== null).join(" · "),
  badges: {
    late: "en retard",
    open: "ouverte",
    blocked: "bloquée",
    delivered: "livrée",
  },
  stepsDelivered: (done: number, total: number) =>
    `${plural(done, "étape livrée", "étapes livrées")} sur ${total}`,
  stepsBar: "Étapes de la fonctionnalité",
  expected: "Résultat attendu · ce qu'on montrera à la démo",
  expectedEmpty: "Aucun résultat attendu décrit.",
  editExpected: "Modifier le résultat attendu",
  expectedField: "Résultat attendu",
  save: "Enregistrer",
  cancel: "Annuler",
  journey: "Parcours de A à Z",
  journeyHint: "étapes libres, dans l'ordre des dépendances",
  addStep: "Ajouter une étape",
  merged: "fusionnée",
  waiting: (key: string) => `attend ${key}`,
  session: (agent: string, minutes: number) => `session · ${agent} · ${minutes} min`,
  noDelivery: "—",
  nextStep: (blockers: readonly string[]) =>
    blockers.length === 0
      ? "Prochaine étape à livrer."
      : `Prochaine étape à livrer une fois ${blockers.join(", ")} ${blockers.length > 1 ? "fusionnées" : "fusionné"}.`,
  deliverNext: "Livrer la prochaine étape",
  copied: "Commande copiée",
  copyRefused: "Copie refusée : sélectionne la commande à la main.",
  sprint: "Sprint",
  unplanned: "À planifier",
  chooseSprint: "Choisir le sprint",
  remainingSteps: (n: number) => plural(n, "étape restante", "étapes restantes"),
  wontFit: (n: number, sprint: string) =>
    `${plural(n, "étape restante", "étapes restantes")} : ne tiendra pas dans ${sprint}.`,
  sprintOver: (n: number, sprint: string) =>
    `${plural(n, "étape restante", "étapes restantes")} : ${sprint} est terminé.`,
  moveTo: (sprint: string) => `Déplacer en ${sprint}`,
  dependencies: "Dépendances",
  waitsFor: "Attend",
  unblocks: "Débloque",
  noDependency: "Aucune dépendance entre fonctionnalités.",
  questions: "Questions",
  noQuestion: "Aucune question ouverte.",
  activity: "Activité",
  noActivity: "Aucune activité de livraison.",
  prOpened: (n: number, key: string) => `PR #${n} ouverte · ${key}`,
  prMerged: (n: number, key: string) => `PR #${n} fusionnée · ${key}`,
  stepDone: (step: number, label: string, key: string) => `Étape ${step} · ${label} · ${key}`,
  footer: "Une fonctionnalité ne se lance pas : chaque étape se livre dans T3 Code avec full-delivery.",
  optional: "Étape facultative",
  optionalHint: "Ne compte pas pour livrer la fonctionnalité",
  ticketSprint: "Sprint",
  yesterday: "hier",
  today: "aujourd'hui",
  daysAgo: (n: number) => `il y a ${n} j`,
  month: (index: number) => MONTHS[index] ?? "",
};
