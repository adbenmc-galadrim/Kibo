import { liveReview, type OnHold, type PrChecks, type PrReview } from "@kibo/schema";
import { PLAN_USAGE } from "./fr-plan";
import { QUESTIONS_USAGE } from "./fr-questions";
import { SPRINTS_USAGE } from "./fr-sprints";
import { DAEMON_HELP, PROJECT_HINT, usageText } from "./fr-usage";
import { FEATURES_USAGE, TICKETS_WRITE_USAGE } from "./fr-write";
import type { FeatureRef, SprintRef } from "./tickets/ticket-tracking";
import type { AssigneeSummary, BranchSummary, PrSummary, TicketRef } from "./tickets/ticket-view";

const TICKETS_USAGE = [
  "  kibo tickets list --project <clé|nom|id> [--ready] [--status <s>[,<s>…]] [--sprint <id|code|nom|current|none>] [--feature <F|clé>] [--label <a[,b]>] [--fields key,title,status,sprint] [--json]",
  "  kibo tickets get <clé|id du plan> [--project <p>] [--json]",
  "  kibo tickets set <clé|id du plan> [status=<todo|wip|done|blocked>] [pr=<n|url>] [branch=<nom> [base=<nom>]] [reason=<texte>] [hold=<raison>|off] [--project <p>] [--json]",
  "  kibo tickets step <clé> <0-11> [note] [--update] [--json]",
  "  kibo tickets session [<clé>] <start|ping|stop> [--tool <nom>] [--project <p>] [--json]",
  ...TICKETS_WRITE_USAGE,
];

const PROJECTS_USAGE = ["  kibo projects list [--json]", "  kibo projects get <clé|nom|id> [--json]"];

const RPC_USAGE = ["  kibo rpc '<json>' | @fichier | @-"];

const REVIEW_LABELS: Record<PrReview, string | null> = {
  none: null,
  review_required: null,
  approved: "approuvée",
  changes_requested: "changements demandés",
};
const CHECKS_LABELS: Record<PrChecks, string> = {
  ok: "CI verte",
  error: "CI cassée",
  running: "CI en cours",
};
const prParts = (pr: PrSummary): string[] =>
  [
    `#${pr.number} (${pr.state})`,
    REVIEW_LABELS[liveReview(pr)],
    pr.checks === null ? null : CHECKS_LABELS[pr.checks],
    pr.url,
  ].filter((part) => part !== null);

const assigneeName = (a: AssigneeSummary) => (a.kind === "agent" ? `agent ${a.ref}` : a.me ? "moi" : a.ref);
const branchName = (b: BranchSummary) => (b.base === null ? b.name : `${b.name} (base ${b.base})`);

const ref = (r: TicketRef) => `${r.key}${r.planId ? ` (${r.planId}, ${r.status})` : ` (${r.status})`}`;
const refs = (list: TicketRef[], none: string) => (list.length === 0 ? none : list.map(ref).join(", "));

const precise = (keys: readonly string[]) =>
  keys.length === 1 ? `précise --project ${keys[0]}` : `précise --project parmi ${keys.join(", ")}`;

export const frTickets = {
  usage: usageText(TICKETS_USAGE, PROJECT_HINT, DAEMON_HELP),
  precise,
  featureNeedsProject: (keys: readonly string[]) => `clé de fonctionnalité : ${precise(keys)}`,
  notRunning: "Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie.",
  projectNotFound: (p: string) => `Projet introuvable : ${p}`,
  ticketNotFound: (id: string) => `Ticket introuvable : ${id}`,
  sprintNotFound: (name: string) => `Sprint introuvable : ${name}`,
  notesUnavailable: "Notes liées indisponibles : ce démon Kibo est plus ancien que la commande kibo.",
  defaultBlockedReason: "Bloqué par la livraison (kibo tickets)",
  updated: (key: string, changes: string[], status: string | null) =>
    `✓ ${key} : ${changes.length === 0 ? "déjà à jour" : changes.join(", ")}${status === null ? "" : ` · ${status}`}`,
  statusChange: (status: string) => `statut ${status}`,
  branchChange: (branch: string, base: string | null) =>
    base === null ? `branche ${branch}` : `branche ${branch} (base ${base})`,
  prChange: (n: number) => `PR #${n}`,
  status: (status: string, column: string) => `Statut : ${status} (${column})`,
  blocked: (reason: string) => `Raison du blocage : ${reason}`,
  parent: (r: TicketRef | null) => `Parent : ${r ? ref(r) : "aucun"}`,
  sprint: (s: SprintRef | null) => `Sprint : ${s ? `${s.code} · ${s.name}` : "aucun"}`,
  feature: (f: FeatureRef | null) =>
    `Fonctionnalité : ${f ? [f.shortKey, f.key, f.title].filter((part) => part !== null).join(" · ") : "aucune"}`,
  optional: "Étape facultative",
  children: (list: TicketRef[]) => `Enfants : ${refs(list, "aucun")}`,
  deps: (list: TicketRef[]) => `Dépendances : ${refs(list, "aucune")}`,
  pr: (pr: PrSummary | null) => `PR : ${pr ? prParts(pr).join(" · ") : "aucune"}`,
  session: (tool: string, since: string) => `Session : ${tool} · depuis ${since}`,
  touchUp: (label: string) => `Retouche · ${label}`,
  assignee: (a: AssigneeSummary | null) => `Assigné : ${a ? assigneeName(a) : "personne"}`,
  branch: (b: BranchSummary | null) => `Branche : ${b ? branchName(b) : "aucune"}`,
  demo: (feature: string) => `Démo · ${feature}`,
  columns: ["Clé", "Plan", "F", "Statut", "Titre"],
  noTickets: "Aucun ticket dans ce projet.",
  noMatch: (filters: string) => `Aucun ticket pour ces filtres : ${filters}`,
  labels: (labels: string[]) => `Étiquettes : ${labels.length === 0 ? "aucune" : labels.join(", ")}`,
  brief: (path: string | null) => `Brief : ${path ?? "aucun"}`,
  notes: (paths: string[]) => `Notes : ${paths.length === 0 ? "aucune" : paths.join(", ")}`,
  questions: (n: number) => (n === 0 ? "Questions : aucune" : "Questions :"),
  question: (state: string, title: string, recipient: string, blocking: boolean) =>
    `  - [${state}] ${title} → ${recipient}${blocking ? " (bloquante)" : ""}`,
  description: "Description :",
  noDescription: "Description : aucune",
  stepOutOfRange: (step: string) => `Étape invalide : ${step} (étape entre 0 et 11)`,
  stepDone: (key: string, label: string) => `✓ ${key} : ${label}`,
  touchUpDone: (key: string, label: string) => `✓ ${key} : retouche · ${label}`,
  sessionOn: (key: string | null, tool: string, since: string) =>
    key === null ? `✓ Session ${tool} depuis ${since}` : `✓ ${key} : session ${tool} depuis ${since}`,
  sessionOver: (key: string | null) => (key === null ? "✓ Session terminée" : `✓ ${key} : session terminée`),
  noSession: "Aucune session en cours.",
  noBranchTicket: "Aucun ticket ne déclare cette branche.",
  notStartable: (key: string, reasons: readonly string[]) =>
    `⚠ ${key} n'était pas démarrable : ${reasons.join(" · ")}`,
  reasons: {
    question: (label: string) => `bloqué par ${label}`,
    waiting: (keys: readonly string[]) => `attend ${keys.join(", ")}`,
    sprint: (code: string) => `sprint ${code}`,
    unplanned: "sans sprint",
    limit: "limite atteinte",
    onHold: (hold: OnHold) =>
      hold.source === "own" ? `en attente : ${hold.reason}` : `en attente de ${hold.key}`,
  },
  hold: {
    set: (reason: string) => `en attente : ${reason}`,
    off: "reprise",
    since: (day: string) => `depuis le ${day}`,
    line: (reason: string, day: string) => `En attente : ${reason} · ${day}`,
    of: (key: string) => `En attente de ${key}`,
    empty: "hold= attend une raison ou off",
    months: [
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
    ],
  },
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const agreed = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`;
const recipeSummary = ({ copy, after }: { copy: readonly string[]; after: readonly string[] }) =>
  `${plural(copy.length, "fichier")} ${agreed(copy.length, "copié")}, ${plural(after.length, "commande")} après`;

export const frProjects = {
  usage: ["Usage :", ...PROJECTS_USAGE].join("\n"),
  title: (key: string, name: string) => `${key} · ${name}`,
  folder: (folder: string | null) => `Dossier : ${folder ?? "aucun"}`,
  worktree: (w: { baseRef: string; pathTemplate: string } | null) =>
    `Worktree : ${w ? `${w.baseRef} · ${w.pathTemplate}` : "réglages par défaut"}`,
  recipe: (r: { copy: readonly string[]; after: readonly string[] } | null) =>
    `Recette : ${r ? recipeSummary(r) : "aucune"}`,
  delivery: (d: { agent: string | null; root: string | null } | null) =>
    `Livraison : ${d ? `agent ${d.agent ?? "aucun"} · dossier ${d.root ?? "aucun"}` : "non configurée"}`,
};

export const frRpc = {
  usage: usageText(RPC_USAGE, "Envoie la requête telle quelle à POST /api/rpc.", DAEMON_HELP),
  unreadable: (reason: string) => `JSON illisible : ${reason}`,
  noMethod: "La requête doit être un objet JSON avec une méthode (« method »).",
};

export const fr = {
  usage: [
    "Usage :",
    ...FEATURES_USAGE,
    ...TICKETS_USAGE,
    ...SPRINTS_USAGE,
    ...QUESTIONS_USAGE,
    ...PLAN_USAGE,
    ...PROJECTS_USAGE,
    ...RPC_USAGE,
    "",
    DAEMON_HELP,
  ].join("\n"),
  daemonInfoCorrupt: (file: string) =>
    `Le fichier ${file} est corrompu : relance l'application Kibo, ou supprime ce fichier puis réessaie.`,
  pairingFailed: "Appairage refusé : le jeton de ~/.kibo/token ne correspond pas.",
  error: (code: string, message: string) => `Erreur ${code} : ${message}`,
  daemonTooOld: (daemon: string, command: string) =>
    `Le démon ${daemon} est trop ancien pour kibo ${command} : mets Kibo à jour, puis réessaie.`,
  daemonError: (code: string, message: string, home: string, version: string | null) =>
    `Erreur ${code} : ${message} (démon ${home}, ${version ?? "version inconnue"})`,
  daemonName: (home: string, version: string | null) => `${home} (${version ?? "version inconnue"})`,
};
