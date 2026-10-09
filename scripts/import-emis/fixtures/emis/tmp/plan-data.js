window.PLAN_DATA = {
  meta: {
    title: "EMIS — Plan de PRs (fictif)",
    subtitle: "Suivi fictif pour les tests",
    updatedAt: "2026-10-06",
    repo: "https://github.com/acme/emis-fixture",
    firstSprintDate: "2026-09-28",
    deadline: { label: "Mise en production", date: "2026-12-18", note: "Date **fictive**." },
    sources: [{ label: "Passation", href: "../PASSATION.md" }],
  },

  etat: {
    livre: ["Monorepo `pnpm` en place", "CI **verte**"],
    manquant: ["⚠️ Aucun hébergement"],
  },

  decisions: [
    {
      id: "D1",
      title: "Le dépôt fait foi",
      body: ["Toute PR part du socle livré, voir C0-1."],
    },
  ],

  phases: [
    { id: "P1", label: "Socle", goal: "Se connecter.", note: "Rien de métier." },
    { id: "P2", label: "Atelier", goal: "Remplacer le papier.", note: "Réseau disponible." },
  ],

  chapters: [
    {
      id: "C0",
      title: "Socle",
      tagline: "Sans socle, rien ne tient.",
      prs: [
        {
          id: "C0-1",
          phase: "P1",
          sprint: "S0",
          status: "done",
          areas: ["infra"],
          deps: [],
          title: "Socle monorepo",
          why: "Pose la plomberie commune.",
        },
        {
          id: "C0-2",
          phase: "P1",
          sprint: "S1",
          status: "review",
          pr: 4,
          areas: ["web"],
          deps: ["C0-1"],
          branch: "feat/coquille",
          title: "Coquille applicative",
          why: "Donne un **cadre** aux écrans.",
        },
        {
          id: "C0-3",
          phase: "P1",
          sprint: "S1",
          status: "blocked",
          areas: ["infra"],
          deps: ["C0-1"],
          title: "Hébergement",
          why: "Rien ne se recette sans staging.",
          note: "Attend AWS",
        },
      ],
    },
    {
      id: "C1",
      title: "Connexion",
      tagline: "Un salarié se connecte avec son compte.",
      prs: [
        {
          id: "C1-1",
          phase: "P1",
          sprint: "S1",
          status: "review",
          pr: 7,
          areas: ["api"],
          deps: ["C0-1"],
          branch: "spike/sso",
          title: "Spike SSO",
          why: "Valide le fournisseur.",
        },
        {
          id: "C1-2",
          phase: "P1",
          sprint: "S2",
          status: "todo",
          areas: ["web", "api"],
          deps: ["C1-1", "C0-2"],
          branch: "feat/connexion",
          title: "Connexion Microsoft",
          why: "Remplace le mot de passe par le `SSO`. Le reste attend.",
          perimetre: ["Route `/login`", "Session **serveur**"],
          tests: ["Connexion refusée hors annuaire"],
          pieges: ["⚠️ Le jeton expire en une heure"],
        },
        {
          id: "C1-3",
          phase: "P2",
          sprint: "S3",
          status: "todo",
          areas: ["web"],
          deps: ["C1-2"],
          title: "Compte non provisionné",
          why: "Explique au salarié pourquoi il ne voit rien.",
        },
      ],
    },
  ],

  sprints: [
    { id: "S0", from: "28/09", main: "Déjà livré : C0-1", parallel: "" },
    { id: "S1", from: "05/10", main: "C0-2, C0-3, C1-1", parallel: "" },
    { id: "S2", from: "12/10", main: "C1-2", parallel: "" },
    { id: "S3", from: "19/10", main: "", parallel: "C1-3" },
  ],
  sprintNote: "Calendrier **fictif**.",

  criticalPath: {
    // biome-ignore lint/suspicious/noThenProperty: champ du plan d'Emis
    chains: [{ label: "Connexion", steps: ["C0-2", "C1-2"], then: "tout le reste" }],
    verrous: [{ label: "Compte AWS", text: "Rien ne se déploie avant." }],
  },

  arbitrages: [
    {
      group: "Client — bloquants",
      tone: "critical",
      items: [
        { ref: "Q1", blocks: "C0-3", resolved: false, question: "**Compte AWS** au nom du client. Estelle." },
      ],
    },
    {
      group: "Internes",
      tone: "info",
      items: [
        { ref: "Q2", blocks: "—", resolved: true, question: "**Charge** : marge faible." },
        {
          ref: "Q3",
          blocks: "C1-2",
          resolved: false,
          question: "**Un seul bouton de connexion ?** À confirmer.",
        },
      ],
    },
  ],

  process: [
    "Lire la section concernée de `PASSATION.md` avant toute PR métier.",
    "Les PR de feature ciblent `dev`.",
    "**Passer `status` et `pr:` dans ce fichier**, puis `node plan-check.mjs`.",
  ],
};
