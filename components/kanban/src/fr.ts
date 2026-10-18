import { DELIVERY_STEP_LABELS, DELIVERY_STEP_MAX, FULL_DELIVERY_AGENT, type RunState } from "@kibo/schema";

const RUN_STATES: Record<RunState, string> = {
  queued: "En file",
  starting: "Démarrage",
  running: "En cours",
  waiting_input: "Attend une réponse",
  done: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
};

export const fr = {
  session: (tool: string) => `Session ${tool} en cours`,
  retouch: (step: string) => `retouche · ${step}`,
  filter: { label: "Tickets affichés", mineAndAgents: "Moi + agents", mine: "Moi" },
  mode: {
    all: "Tous",
    sprint: (code: string | null) => (code === null ? "Sprint courant" : `Sprint courant · ${code}`),
    startable: "Démarrable",
    toFix: "À reprendre",
  },
  counter: (shown: number, mode: string, mine: string | null) =>
    `${shown} ticket${shown > 1 ? "s" : ""} · ${mode}${mine === null ? "" : ` · ${mine}`}`,
  labelFilter: {
    label: "Filtrer par étiquette",
    all: "Étiquette : toutes",
    one: (label: string) => `Étiquette : ${label}`,
    failed: "Impossible de lire ou d'enregistrer le filtre d'étiquette.",
  },
  hidden: (n: number) => `${n} masqué${n > 1 ? "s" : ""} · Tout afficher`,
  newTicketIn: (status: string) => `Nouveau ticket dans ${status}`,
  actions: (key: string) => `Actions ${key}`,
  moveTo: "Déplacer vers",
  open: "Ouvrir",
  remove: "Supprimer…",
  removeTitle: (key: string) => `Supprimer ${key} ?`,
  removeHelp: (children: number) =>
    children === 0
      ? "Ses liens seront supprimés aussi. Cette action est irréversible."
      : `Ses ${children} sous-ticket${children > 1 ? "s" : ""} et ses liens seront supprimés aussi. Cette action est irréversible.`,
  removeConfirm: "Supprimer",
  cancel: "Annuler",
  orderUnavailable: "Impossible de lire l'ordre des cartes.",
  drag: {
    help: "Pour déplacer une carte, appuie sur Espace ou Entrée, choisis sa place avec les flèches, puis appuie de nouveau sur Espace ou Entrée. Échap annule.",
    picked: (key: string) => `${key} saisi.`,
    over: (key: string, target: string) => `${key} au-dessus de ${target}.`,
    outside: (key: string) => `${key} hors des colonnes.`,
    dropped: (key: string, target: string) => `${key} déposé sur ${target}.`,
    cancelled: (key: string) => `Déplacement de ${key} annulé.`,
  },
  moveFailed: (key: string) => `Impossible de déplacer ${key}.`,
  heldBy: (key: string, question: string) => `${key} reste bloqué par ${question}`,
  answer: "Répondre",
  empty: { text: "Les étapes avancent seules avec git et les PR.", action: "Nouveau ticket" },
  phaseHint: (step: number) =>
    `Phase ${step} sur ${DELIVERY_STEP_MAX + 1} de ${FULL_DELIVERY_AGENT} : ${DELIVERY_STEP_LABELS[step] ?? ""}`,
  waitingOn: (key: string) => `attend ${key}`,
  questions: (n: number) => `${n} question${n > 1 ? "s" : ""}`,
  questionsOpen: (n: number) => `${n} question${n > 1 ? "s" : ""}, ouvrir`,
  blockedReason: (reason: string) => `Motif : ${reason}`,
  ci: { ok: "CI réussie", error: "CI cassée", running: "CI en cours", neutral: "CI sans verdict" },
  ciShort: { ok: "CI", error: "CI cassée", running: "CI en cours", neutral: "CI" },
  changesRequested: "changements demandés",
  blocked: "bloqué",
  blockedBy: (question: string) => `bloqué · ${question}`,
  optional: "facultative",
  demo: (feature: string) => `Démo · ${feature}`,
  ciUnavailable: (message: string) => `CI indisponible : ${message}`,
  reason: {
    sprint: (code: string) => `sprint ${code}`,
    unplanned: "sans sprint",
    limit: (count: number, limit: number) => `limite ${count}/${limit}`,
  },
  branch: (name: string) => `Branche ${name}`,
  changesShort: "changements",
  mention: {
    history: "Voir l'historique",
    reply: "Répondre",
    step: (index: number, total: number, title: string) => `${index}/${total} · ${title}`,
    state: (state: RunState) => RUN_STATES[state],
    waiting: "Attend une réponse",
  },
  run: {
    queued: (position: number | null) => (position === null ? "En file" : `En file #${position}`),
    waiting: "Attend",
    failed: "Échec",
  },
  block: {
    title: (key: string) => `Bloquer ${key}`,
    description: "Un ticket bloqué attend une condition extérieure au projet.",
    reason: "Motif",
    placeholder: "Informations attendues du client",
    cancel: "Annuler",
    confirm: "Bloquer",
  },
};
