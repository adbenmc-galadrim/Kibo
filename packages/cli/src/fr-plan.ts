import type { FeatureStatus, SprintState } from "@kibo/schema";
import type { FrError } from "./fr-errors";
import { DAEMON_HELP, usageText } from "./fr-usage";

export const PLAN_USAGE = [
  "  kibo plan apply <fichier.yaml|json> [--dry-run] --project <p> [--json]",
  "  kibo plan export [--md] --project <p>",
];

const UNKNOWN_KEY = "(clé inconnue)";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const frPlan = {
  usage: usageText(PLAN_USAGE, DAEMON_HELP),
  unknownField: (name: string, fields: readonly string[]) =>
    `Champ inconnu : ${name}. Champs : ${fields.join(", ")}`,
  markdown: {
    unplanned: "Sans sprint",
    lone: "Hors fonctionnalité",
    sprintState: { done: "terminé", current: "en cours", planned: "prévu" } satisfies Record<
      SprintState,
      string
    >,
    featureStatus: {
      todo: "à faire",
      open: "ouverte",
      blocked: "bloquée",
      late: "en retard",
      delivered: "livrée",
    } satisfies Record<FeatureStatus, string>,
    waiting: (keys: readonly string[]) => `attend ${keys.join(", ")}`,
    optional: "facultative",
    onHold: (reason: string) => `en attente : ${reason}`,
    questions: (n: number) => plural(n, "question ouverte", "questions ouvertes"),
  },
  apply: {
    newRef: (ref: string, key: string | null | undefined) =>
      key === undefined ? ref : key === null ? `${ref} ${UNKNOWN_KEY}` : `${ref} (→ ${key})`,
    createdKey: (key: string | null | undefined) =>
      key === undefined ? "" : key === null ? ` ${UNKNOWN_KEY}` : ` → ${key}`,
    createFeature: (title: string) => `crée la fonctionnalité « ${title} »`,
    createStep: (title: string, parent: string) => `crée l'étape « ${title} » sous ${parent}`,
    createTicket: (title: string) => `crée le ticket « ${title} »`,
    updateTicket: (ticket: string, fields: readonly string[]) => `modifie ${ticket} : ${fields.join(", ")}`,
    fields: { title: "titre", description: "description", labels: "étiquettes", parent: "parent" },
    setStatus: (ticket: string, status: string, reason: string | undefined) =>
      `passe ${ticket} en ${status}${reason === undefined ? "" : ` (${reason})`}`,
    hold: (ticket: string, reason: string) => `met ${ticket} en attente : ${reason}`,
    release: (ticket: string) => `lève l'attente de ${ticket}`,
    link: (from: string, to: string) => `${from} bloque ${to}`,
    unlink: (from: string, to: string) => `${from} ne bloque plus ${to}`,
    unrelate: (from: string, to: string) => `retire le lien entre ${from} et ${to}`,
    createSprint: (code: string, name: string, start: string, end: string) =>
      `crée le sprint ${code} « ${name} » du ${start} au ${end}`,
    setSprint: (sprint: string, ticket: string) => `pose ${sprint} sur ${ticket}`,
    clearSprint: (ticket: string) => `retire le sprint de ${ticket}`,
    createQuestion: (title: string, ticket: string) => `ajoute la question « ${title} » sur ${ticket}`,
    answerQuestion: (id: string, answer: string) => `répond à la question ${id} : ${answer}`,
    updateQuestion: (id: string) => `modifie la question ${id}`,
    reopenQuestion: (id: string) => `rouvre la question ${id}`,
    deleteQuestion: (id: string) => `supprime la question ${id}`,
    addRecipient: (name: string) => `ajoute le destinataire ${name}`,
    line: (id: number, text: string) => `${id}. ${text}`,
    applied: (id: number, text: string) => `✓ ${id}. ${text}`,
    created: (key: string, title: string) => `${key} créée : ${title}`,
    failed: (id: number, text: string, detail: string | null) =>
      `✗ ${id}. ${text}${detail === null ? "" : ` : ${detail}`}`,
    skipped: (id: number, detail: string | null) =>
      `– ${id}. ignorée${detail === null ? "" : ` : ${detail}`}`,
    createdList: (pairs: readonly { ref: string; key: string }[]) =>
      `Créés : ${pairs.map((p) => `${p.ref} → ${p.key}`).join(", ")}`,
    stoppedAt: (id: number) => `Arrêt à l'action ${id}.`,
    problem: (id: number, type: string, message: string) => `#${id} ${type} : ${message}`,
    title: (name: string) => `Plan : ${name}`,
    dryRun: (n: number) => `${plural(n, "action", "actions")}, rien n'est écrit (--dry-run).`,
    refused: (n: number) => `Plan refusé : ${plural(n, "problème", "problèmes")}, rien n'est écrit.`,
  },
};

const INVALID = "Plan invalide :";

export const PLAN_FILE_ERRORS: readonly FrError[] = [
  { code: "INVALID_INPUT", match: /^plan unreadable: ([\s\S]+)$/, text: (m) => `Plan illisible : ${m[1]}` },
  {
    code: "INVALID_INPUT",
    match: /^plan: actions must be a non-empty list$/,
    text: () => `${INVALID} il faut une liste « actions » non vide.`,
  },
  {
    code: "INVALID_INPUT",
    match: /^plan: give every action an id, or none$/,
    text: () => `${INVALID} donnez un id à chaque action, ou à aucune.`,
  },
  {
    code: "INVALID_INPUT",
    match: /^plan: at most (\d+) actions$/,
    text: (m) => `${INVALID} ${m[1]} actions au plus.`,
  },
  {
    code: "VALIDATION_FAILED",
    match: /^action \d+: [\s\S]+$/,
    text: (m) => [INVALID, ...m[0].split("\n").map((line) => `  ${line}`)].join("\n"),
  },
];
