export const frMoments = {
  activity: {
    details: "Détails",
    activity: "Activité",
    tabs: "Vues du ticket",
    report: "Compte rendu",
    chronology: "Chronologie",
    mixed: "plan et fil mêlés",
    runs: "Chronologie des runs",
    run: (n: number) => `Run ${n}`,
    today: (clock: string) => `aujourd'hui ${clock}`,
    yesterday: (clock: string) => `hier ${clock}`,
    span: (from: string, to: string) => `${from} → ${to}`,
    older: "Charger les runs plus anciens",
    noRuns: "Aucun run sur ce ticket.",
    unavailable: "Fil indisponible pour l'instant.",
    confirmed: "Confirmé",
  },
};
