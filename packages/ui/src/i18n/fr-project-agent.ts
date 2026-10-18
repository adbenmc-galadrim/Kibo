import type { ActionGroup, ActionOutcome, BatchStatus, SessionFreshReason } from "@kibo/schema";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const pluralWord = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`;

export type RecapOutcome = "applied" | "failed" | "skipped";

const RECAP_OUTCOMES: Record<RecapOutcome, string> = {
  applied: "appliquée",
  failed: "échouée",
  skipped: "ignorée",
};

const FRESH_REASONS: Record<SessionFreshReason, string> = {
  no_previous: "première session",
  agent_changed: "autre agent",
  transcript_missing: "transcript introuvable",
  workspace_changed: "autre dossier de travail",
  user_reset: "repartie de zéro",
};

const GROUPS: Record<ActionGroup, string> = {
  tickets: "Tickets",
  sprints: "Sprints",
  agents: "Agents",
  questions: "Questions",
  notes: "Notes",
  signals: "Signaux",
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
  titleSuffix: (project: string) => ` · ${project}`,
  close: "Fermer le panneau",
  tabs: {
    label: "Vues de l'agent de projet",
    conversation: "Conversation",
    signals: (n: number) => (n > 0 ? `Signaux · ${n}` : "Signaux"),
  },
  status: {
    ready: "Prêt",
    queued: "En file",
    thinking: "Réfléchit…",
    batch: "Lot à valider",
  },
  tracking: {
    title: "Agent de projet",
    upToDate: (age: string) => `Suivi à jour · ${age}`,
    summary: "Résumé du jour",
    earlierSummary: "Dernier résumé",
    summaryDay: (day: string, time: string) => `${day} · ${time}`,
    noSummary: (project: string) => `Pose une question sur ${project} ou attends la fin du sprint.`,
    toValidate: "À valider",
    footer: "Les états avancent seuls (git, PR, étapes full-delivery). L'agent propose, tu valides.",
    ask: "Demander à l'agent de projet…",
    pinned: "épinglé",
    exchange: "Dernière question",
    asked: (time: string) => `Toi · ${time}`,
    superseded: (n: number) =>
      `${n} ${pluralWord(n, "lot")} ${pluralWord(n, "remplacé")} ${pluralWord(n, "masqué")}`,
    showSuperseded: "Afficher les lots remplacés",
    show: "Afficher",
  },
  reminder: {
    greeting: "Bonjour,",
    about: (question: string) => `Je reviens vers vous au sujet de « ${question} »`,
    blocks: (impact: string) => `Elle ${impact}`,
    concerns: (impact: string) => `Elle est posée ${impact}`,
    closing: "Pourriez-vous nous répondre ? Merci.",
    copy: "Copier la relance",
  },
  recap: {
    title: (seq: number) => `Lot n° ${seq} validé`,
    close: "Fermer",
    word: (outcome: RecapOutcome, n: number) => pluralWord(n, RECAP_OUTCOMES[outcome]),
    counts: (applied: number, failed: number, skipped: number) =>
      [
        `${applied} ${pluralWord(applied, RECAP_OUTCOMES.applied)}`,
        `${failed} ${pluralWord(failed, RECAP_OUTCOMES.failed)}`,
        `${skipped} ${pluralWord(skipped, RECAP_OUTCOMES.skipped)}`,
      ].join(" · "),
    outcome: (outcome: RecapOutcome) => RECAP_OUTCOMES[outcome],
    slipped: (feature: string, sprint: string) => `${feature} glissée de ${sprint}`,
  },
  menu: {
    label: "Actions de l'agent de projet",
    tracking: "Suivi",
    conversation: "Conversation",
    signals: (n: number) => (n > 0 ? `Signaux · ${n}` : "Signaux"),
    reset: "Nouvel agent de projet",
    past: "Anciens agents",
    memory: "Ouvrir la mémoire",
    showSuperseded: "Afficher les lots remplacés",
    hideSuperseded: "Masquer les lots remplacés",
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
    lastRun: "Dernier run",
    run: "Run",
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
    afterWakeup: "après réveil",
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
    createQuestionFor: (ticket: string, recipient: string, title: string) =>
      `Question sur ${ticket} pour ${recipient} : « ${title} »`,
    updateQuestion: (title: string) => `Modifier la question « ${title} »`,
    reopenQuestion: (title: string) => `Rouvrir « ${title} » (réponse retirée)`,
    deleteQuestion: (title: string) => `Archiver « ${title} »`,
    addRecipient: (name: string) => `Ajouter le destinataire « ${name} »`,
    createNote: (path: string) => `Créer la note ${path}`,
    updateNote: (path: string) => `Mettre à jour la note ${path}`,
    dismissSignal: (ref: string) => `Signal ${ref} : sans suite`,
    postpone: (feature: string, sprint: string) => `Reporter ${feature} en ${sprint}`,
    plan: (feature: string, sprint: string) => `Planifier ${feature} en ${sprint}`,
    unplan: (feature: string) => `Retirer ${feature} du planning`,
    createSprint: (code: string, name: string) => `Créer le sprint ${code} · ${name}`,
    remindQuestion: (recipient: string, ref: string) => `Relancer ${recipient} sur ${ref}`,
    theClient: "le client",
    remindUnknown: "Relancer « question introuvable »",
    quoted: (title: string) => `« ${title} »`,
    confirm: "Confirmer",
    none: "aucun",
    unknownTicket: "ticket introuvable",
    unknownQuestion: "question introuvable",
  },
  field: {
    title: "Titre",
    description: "Description",
    labels: "Étiquettes",
    parent: "Parent",
    status: "Statut",
    recipient: "Destinataire",
    ticket: "Ticket",
    options: "Options",
    provisional: "Choix provisoire",
  },
  button: "Agent de projet",
  buttonTitle: (shortcut: string) => `Agent de projet (${shortcut})`,
  pending: (n: number) => (n > 0 ? `${plural(n, "action")} à valider` : "Un lot attend ta validation"),
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
