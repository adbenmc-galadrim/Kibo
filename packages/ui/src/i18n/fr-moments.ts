import type { ActionKind, PartialReason, RunActionOutcome, RunState, StepStatus } from "@kibo/schema";
import { fr } from "./fr";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const kinds: Record<ActionKind, string> = {
  read: "Lu",
  edit: "Modifié",
  create: "Créé",
  search: "Recherche",
  test: "Tests",
  install: "Installation",
  git: "Git",
  command: "Commande",
  question: "Question",
  progress: "Plan",
  todo: "Tâches",
  mcp: "Outil",
  subagent: "Sous-agent",
  signal: "Signal",
  other: "Outil",
};

const outcomes: Record<RunActionOutcome, string> = { ok: "réussi", error: "en échec", denied: "refusé" };

const partial: Record<PartialReason, string> = {
  "path-rejected": "Fil partiel : transcription refusée",
  unreadable: "Fil partiel : transcription illisible",
  "unknown-format": "Fil partiel : format de transcription inconnu",
};

const steps: Record<StepStatus, string> = {
  todo: "à faire",
  doing: "en cours",
  done: "fait",
  blocked: "bloqué",
};

export const frMoments = {
  feed: (label: string) => `Fil de ${label}`,
  empty: "Rien dans le fil pour l'instant.",
  step: (index: number) => `Étape ${index}`,
  reminders: {
    plan: "Kibo a rappelé de déclarer le plan",
    report: "Kibo a rappelé de remplir le compte rendu",
  },
  partial,
  reasoning: "Raisonnement",
  exchange: { question: "Question de l'agent", human: "Toi" },
  detail: "Voir le détail",
  kinds,
  outcomes,
  patch: (added: number, removed: number) => `+${added} −${removed}`,
  tests: (passed: number, failed: number) => `${passed} ✓ ${failed} ✗`,
  plan: {
    title: "Plan",
    internal: "plan interne de l'agent",
    shared: "ticket_progress",
    empty: "Aucun plan déclaré pour ce run.",
    progress: (done: number, total: number) => `${done}/${total}`,
    status: steps,
    moments: (n: number) => plural(n, "moment", "moments"),
  },
  report: {
    title: "Compte rendu",
    done: "Fait",
    decisions: "Décisions",
    toCheck: (n: number) => `À vérifier (${n})`,
    files: (n: number) => `Fichiers (${n})`,
    undeclared: (n: number) =>
      `${plural(n, "fichier modifié", "fichiers modifiés")} non mentionné${n > 1 ? "s" : ""}`,
    unchanged: (n: number) => `${plural(n, "fichier cité", "fichiers cités")} sans modification`,
    unchecked: "fichiers non vérifiés",
    next: "Suite",
    none: "Pas de compte rendu pour ce run",
  },
  dock: {
    runs: "Runs",
    feed: "Fil",
    plan: "Plan",
    active: (n: number) => `Actifs · ${n}`,
    queued: (n: number) => `En file · ${n}`,
    recent: (n: number) => `Terminés depuis 24 h · ${n}`,
    waiting: "Attend une réponse",
    reportLine: (toCheck: number, undeclared: number) =>
      [
        "fait",
        toCheck > 0 && `${plural(toCheck, "point", "points")} à vérifier`,
        undeclared > 0 &&
          `${plural(undeclared, "fichier", "fichiers")} non mentionné${undeclared > 1 ? "s" : ""}`,
      ]
        .filter(Boolean)
        .join(", "),
    pick: "Choisis un run pour voir son fil.",
    empty: "Aucun run pour l'instant.",
  },
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
  mention: {
    history: "Voir l'historique",
    reply: "Répondre",
    step: (index: number, total: number, title: string) => `${index}/${total} · ${title}`,
    state: (state: RunState) => fr.agents.states[state],
    waiting: "Attend une réponse",
  },
  run: {
    missing: "Run introuvable",
    profile: (profile: string) => `Profil ${profile}`,
    expand: "Ouvrir en grand",
    close: "Fermer",
    resize: "Redimensionner le volet du run",
    feed: "Fil narratif",
    reasoning: "Afficher le raisonnement",
    ticketRuns: "Runs du ticket",
    history: "Historique des runs",
    loading: "Chargement du fil…",
    failed: "Impossible de charger le fil de ce run.",
    report: (previous: boolean) => (previous ? "Compte rendu du run précédent" : "Compte rendu"),
  },
};
