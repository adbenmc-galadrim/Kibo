import type { ActionGroup, ActionOutcome, BatchStatus, SessionFreshReason } from "@kibo/schema";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

const FRESH_REASONS: Record<SessionFreshReason, string> = {
  no_previous: "première session",
  profile_changed: "autre profil",
  transcript_missing: "transcript introuvable",
  workspace_changed: "autre dossier de travail",
  user_reset: "repartie de zéro",
};

const GROUPS: Record<ActionGroup, string> = {
  tickets: "Tickets",
  agents: "Agents",
  questions: "Questions",
  notes: "Notes",
};

const OUTCOMES: Record<ActionOutcome, string> = {
  applied: "Appliquée",
  stale: "Périmée",
  failed: "Échec",
  skipped: "Ignorée",
};

const BATCH_STATUS: Record<BatchStatus, string> = {
  pending: "À valider",
  applied: "Appliqué",
  partial: "Appliqué en partie",
  rejected: "Refusé",
  superseded: "Remplacé par un lot plus récent",
  abandoned: "Abandonné",
};

const TOOLS: Record<string, string> = {
  project_overview: "lit le projet",
  list_tickets: "lit les tickets",
  get_ticket: "lit",
  list_questions: "lit les questions",
  list_runs: "lit les runs",
  list_notes: "lit les notes",
  read_note: "lit",
  list_profiles: "lit les profils",
  project_changes: "lit les changements",
};

export const frProjectAgent = {
  title: (project: string) => `Agent de projet · ${project}`,
  close: "Fermer le panneau",
  status: {
    ready: "Prêt",
    queued: "En file",
    thinking: "Réfléchit…",
    batch: "Lot à valider",
  },
  menu: {
    label: "Actions de l'agent de projet",
    reset: "Nouvel agent de projet",
    past: "Anciens agents",
    memory: "Ouvrir la mémoire",
  },
  reset: {
    title: "Nouvel agent de projet ?",
    description:
      "La conversation actuelle est fermée et reste lisible dans « Anciens agents ». Un lot en attente est abandonné. La note mémoire est gardée.",
    confirm: "Nouvel agent",
    cancel: "Annuler",
  },
  past: {
    title: "Anciens agents",
    empty: "Aucun ancien agent pour ce projet.",
    item: (date: string) => `Session du ${date}`,
    banner: "Ancien agent · lecture seule",
    back: "Retour",
  },
  compose: {
    label: "Message à l'agent de projet",
    empty: (project: string) => `Demande quelque chose sur ${project}…`,
    placeholder: "Écris à l'agent de projet…",
    send: "Envoyer",
    hint: "⌘↵ pour envoyer",
  },
  conversation: {
    label: "Conversation avec l'agent de projet",
    empty: "Aucun message pour l'instant.",
    you: "Toi",
    agent: "Agent de projet",
    reading: (parts: string[]) => parts.join(", "),
    tool: (name: string, detail: string | null) => {
      const verb = TOOLS[name] ?? name;
      return detail ? `${verb} ${detail}` : verb;
    },
    resumed: "Session reprise",
    fresh: (reason: SessionFreshReason) => `Session : nouvelle (${FRESH_REASONS[reason]})`,
    retried: "Nouvelle tentative",
    failed: (error: string) => `Échec du tour : ${error}`,
    cancelled: "Tour annulé",
    retry: "Réessayer",
  },
  batch: {
    region: (seq: number) => `Lot n° ${seq}`,
    group: (group: ActionGroup) => GROUPS[group],
    checkAll: "Tout cocher",
    uncheckAll: "Tout décocher",
    apply: (n: number) => `Valider (${n})`,
    reject: "Refuser",
    rejectConfirm: "Confirmer le refus",
    rejectCancel: "Annuler",
    comment: "Commentaire pour l'agent (facultatif)",
    status: (status: BatchStatus) => BATCH_STATUS[status],
    applying: "Application en cours…",
    outcome: (outcome: ActionOutcome) => OUTCOMES[outcome],
    why: "Pourquoi",
    replaced: "contenu remplacé",
    count: (n: number) => plural(n, "action"),
  },
  action: {
    createTicket: (title: string) => `Créer le ticket « ${title} »`,
    updateTicket: (ticket: string) => `Modifier ${ticket}`,
    setStatus: (ticket: string, status: string) => `${ticket} : passer en ${status}`,
    link: (from: string, to: string) => `${from} bloque ${to}`,
    unlink: (from: string, to: string) => `Retirer le lien entre ${from} et ${to}`,
    assignAgent: (ticket: string, profile: string) => `Assigner ${ticket} à ${profile}`,
    deliverAnswers: (ticket: string) => `Transmettre les réponses de ${ticket}`,
    cancelRun: (runId: string) => `Annuler le run ${runId}`,
    answerQuestion: (answer: string) => `Répondre « ${answer} »`,
    createQuestion: (ticket: string, title: string) => `Question sur ${ticket} : « ${title} »`,
    createNote: (path: string) => `Créer la note ${path}`,
    updateNote: (path: string) => `Mettre à jour la note ${path}`,
    confirm: "Confirmer",
    none: "aucun",
  },
  field: {
    title: "Titre",
    description: "Description",
    labels: "Étiquettes",
    parent: "Parent",
    status: "Statut",
  },
  button: "Agent de projet",
  buttonTitle: (shortcut: string) => `Agent de projet (${shortcut})`,
  pending: "Un lot attend ta validation",
  resize: "Redimensionner le panneau",
  loadFailed: "Impossible de charger l'agent de projet.",
  sendFailed: "Message non envoyé.",
  decideFailed: "Décision non enregistrée.",
  resetFailed: "Impossible de repartir de zéro.",
  profile: {
    name: "Agent de projet",
    parallel: "1 tour à la fois par projet",
    guidelines: "Consignes : guidelines du profil",
  },
} as const;
