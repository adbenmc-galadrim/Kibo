const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const DAY = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export const frToday = {
  title: "Aujourd'hui",
  newProject: "Nouveau projet",
  day: (date: string) => DAY.format(new Date(`${date}T00:00:00Z`)),
  summary: (day: string, projects: number, open: number) =>
    `${day} · ${plural(projects, "projet", "projets")} · ${plural(open, "ticket ouvert", "tickets ouverts")}`,
  calm: "Rien ne bloque, rien à relire, rien à démarrer.",
  showAll: (n: number) => `Tout voir (${n})`,
  blocking: {
    title: "Ce qui bloque",
    aside: (tickets: number, questions: number) =>
      `${plural(tickets, "ticket bloqué", "tickets bloqués")} · ${plural(questions, "question bloquante", "questions bloquantes")} · tous projets`,
    question: (label: string, feature: string | null) =>
      feature === null ? `question · ${label}` : `question · bloque ${feature} · ${label}`,
    detailed: (detail: string, label: string) => `${detail} · ${label}`,
    status: "bloqué",
  },
  prs: {
    title: "PR à relire",
    state: {
      changes: "changements demandés",
      "ci-ok": "à relire · CI verte",
      "ci-running": "à relire · CI en cours",
      review: "à relire",
    },
  },
  startable: {
    title: "Démarrable",
    aside: "aucune dépendance en attente",
    noFeature: "hors fonctionnalité",
    feature: (label: string, title: string) => `${label} · ${title}`,
    copy: (command: string) => `Copier ${command}`,
    actions: (key: string) => `Actions pour ${key}`,
  },
  projects: {
    title: "Projets",
    start: "Pour commencer",
    client: (name: string) => `client ${name}`,
    open: (n: number) => plural(n, "ouvert", "ouverts"),
    blocked: (n: number) => plural(n, "bloqué", "bloqués"),
    risk: (n: number) => `${n} à risque`,
    progress: (done: number, total: number) => `${done} sur ${total}`,
  },
};
