import type { CiTone, PrReview } from "@kibo/schema";

export const frTicketTracking = {
  pr: (n: number) => `PR #${n}`,
  review: {
    none: null,
    approved: "approuvée",
    changes_requested: "changements demandés",
    review_required: "review demandée",
  } satisfies Record<PrReview, string | null>,
  ci: {
    ok: "CI verte",
    error: "CI cassée",
    running: "CI en cours",
    neutral: "CI sans verdict",
  } satisfies Record<CiTone, string>,
  openPr: (n: number) => `Ouvrir la PR #${n} sur GitHub`,
  openJob: "Voir le job",
  banner: "État de la review et de la CI",
  section: "Suivi",
  branch: "Branche",
  branchOn: (base: string) => `sur ${base}`,
  prRow: "PR",
  ciRow: "CI",
  session: "Session",
  step: "Étape",
  issues: "Issues",
  sessionLine: (tool: string, duration: string) => `${tool} · ${duration}`,
  minutes: (n: number) => `${n} min`,
  hours: (n: number) => `${n} h`,
  days: (n: number) => `${n} j`,
  retouch: (label: string) => `Retouche · ${label}`,
  empty: "Aucun suivi git : déclare la branche avec kibo tickets set",
  more: "Domaine et maquettes",
  oldRuns: (n: number) => (n === 1 ? "Ancien run" : `Anciens runs · ${n}`),
  journal: "Journal du ticket",
  noJournal: "Rien dans le journal de ce ticket pour l'instant.",
  journalError: "Journal du ticket indisponible.",
  events: {
    branch: (name: string | null) => (name ? `Branche ${name} créée` : "Branche créée"),
    prOpened: (n: number | null) => (n === null ? "PR ouverte" : `PR #${n} ouverte`),
    prMerged: (n: number | null) => (n === null ? "PR fusionnée" : `PR #${n} fusionnée`),
    review: (n: number | null, review: string | null) =>
      `${n === null ? "PR" : `PR #${n}`} · ${REVIEW_TEXTS[review ?? ""] ?? "review demandée"}`,
    checks: (n: number | null, checks: string | null) =>
      `${n === null ? "PR" : `PR #${n}`} · ${CHECK_TEXTS[checks ?? ""] ?? "CI sans verdict"}`,
    status: (label: string | null) => (label ? `Passé en ${label}` : "Statut changé"),
    step: (label: string | null) => (label ? `Étape ${label}` : "Étape mise à jour"),
    sessionStarted: (tool: string | null) => (tool ? `Session ${tool} ouverte` : "Session ouverte"),
    sessionStopped: (tool: string | null) => (tool ? `Session ${tool} fermée` : "Session fermée"),
    sprint: (code: string | null) => (code ? `Planifié en ${code}` : "Retiré du planning"),
    questionCreated: "Question posée",
    questionAnswered: "Question répondue",
    questionReminded: (ref: string | null) => `${ref ?? "Question"} relancée`,
    other: "Mise à jour du suivi",
  },
};

const REVIEW_TEXTS: Record<string, string> = {
  approved: "approuvée",
  changes_requested: "changements demandés",
};
const CHECK_TEXTS: Record<string, string> = { ok: "CI verte", running: "CI en cours", error: "CI cassée" };
