import type { PrChecks, PrReview } from "@kibo/schema";
import type { FeatureRef, SprintRef } from "./tickets/ticket-tracking";
import type { AssigneeSummary, BranchSummary, PrSummary, TicketRef } from "./tickets/ticket-view";

const MARKET_USAGE = [
  "  kibo market keygen --out <fichier>",
  "  kibo market pack <id>@<version> [--out <fichier>] [--publisher <nom>]",
  "  kibo market index --dir <dossier> --key <fichier> --id <source> --name <nom> [--verify <clés>]",
];

const DAEMON_HELP = "Démon : $KIBO_HOME/daemon.json (défaut ~/.kibo), ou --home <dossier>";
const PROJECT_HINT =
  "Projet de get et set : --project, sinon le préfixe de la clé (EMIS-12), sinon le dossier courant.";

const TICKETS_USAGE = [
  "  kibo tickets list --project <clé|nom|id> [--ready] [--status <s>[,<s>…]] [--sprint <id|code|nom|current|none>] [--json]",
  "  kibo tickets get <clé|id du plan> [--project <p>] [--json]",
  "  kibo tickets set <clé|id du plan> [status=<todo|wip|done|blocked>] [pr=<n|url>] [branch=<nom> [base=<nom>]] [reason=<texte>] [--project <p>] [--json]",
  "  kibo tickets step <clé> <0-11> [note] [--update] [--json]",
  "  kibo tickets session [<clé>] <start|ping|stop> [--tool <nom>] [--project <p>] [--json]",
];

const SPRINTS_USAGE = ["  kibo sprints list --project <clé|nom|id> [--json]"];

const PROJECTS_USAGE = ["  kibo projects list [--json]", "  kibo projects get <clé|nom|id> [--json]"];

const REVIEW_LABELS: Record<PrReview, string | null> = {
  none: null,
  review_required: null,
  approved: "approuvée",
  changes_requested: "changements demandés",
};
const CHECKS_LABELS: Record<PrChecks, string> = { ok: "CI verte", error: "CI rouge", running: "CI en cours" };
const prParts = (pr: PrSummary): string[] =>
  [
    `#${pr.number} (${pr.state})`,
    REVIEW_LABELS[pr.review],
    pr.checks === null ? null : CHECKS_LABELS[pr.checks],
    pr.url,
  ].filter((part) => part !== null);

const assigneeName = (a: AssigneeSummary) =>
  a.kind === "agent" ? `agent ${a.ref}` : (a.name ?? (a.me ? "moi" : a.ref));
const branchName = (b: BranchSummary) => (b.base === null ? b.name : `${b.name} (base ${b.base})`);

const ref = (r: TicketRef) => `${r.key}${r.planId ? ` (${r.planId}, ${r.status})` : ` (${r.status})`}`;
const refs = (list: TicketRef[], none: string) => (list.length === 0 ? none : list.map(ref).join(", "));

export const frTickets = {
  usage: ["Usage :", ...TICKETS_USAGE, "", PROJECT_HINT, DAEMON_HELP].join("\n"),
  featureNeedsProject: "clé de fonctionnalité : préciser --project",
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
  touchUp: (step: number, max: number, label: string) => `Retouche : ${step}/${max} · ${label}`,
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
    blocked: "bloqué",
    waiting: (keys: readonly string[]) => `attend ${keys.join(", ")}`,
    sprint: (code: string) => `sprint ${code}`,
    unplanned: "sans sprint",
    limit: (count: number, limit: number) => `limite ${count}/${limit}`,
  },
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const agreed = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`;
const recipeSummary = ({ copy, after }: { copy: readonly string[]; after: readonly string[] }) =>
  `${plural(copy.length, "fichier")} ${agreed(copy.length, "copié")}, ${plural(after.length, "commande")} après`;

export const frSprints = {
  usage: ["Usage :", ...SPRINTS_USAGE].join("\n"),
};

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

export const fr = {
  usage: [
    "Usage :",
    "  kibo component new <id> [--kind widget|view|both] [--server] [--template blank|3d|game|chart|table]",
    "  kibo component test <id|dossier>",
    "  kibo component dev <id|dossier> [--port <n>]",
    "  kibo component publish <id> [--update-all|--new-version]",
    "  kibo component publish <id> --to <source> [--publisher <nom>]",
    ...MARKET_USAGE,
    ...TICKETS_USAGE,
    ...SPRINTS_USAGE,
    ...PROJECTS_USAGE,
    "",
    DAEMON_HELP,
  ].join("\n"),
  marketUsage: ["Usage :", ...MARKET_USAGE].join("\n"),
  keyWritten: (file: string, fingerprint: string) =>
    `Clé de source écrite dans ${file} · empreinte SHA256 ${fingerprint}`,
  packWritten: (file: string) => `Paquet écrit dans ${file}`,
  indexSigned: (serial: number, packages: number) =>
    `Index n° ${serial} signé (${packages} paquet${packages > 1 ? "s" : ""})`,
  marketPublished: (source: string, serial: number) => `Publié sur ${source} : index n° ${serial}`,
  created: (dir: string) => `Composant créé : ${dir}`,
  next: (id: string) => `Ensuite : kibo component dev ${id}, puis kibo component test ${id}`,
  step: (name: string, ok: boolean) => `${ok ? "✓" : "✗"} ${name}`,
  steps: {
    manifest: "Manifeste",
    imports: "Imports",
    typecheck: "Types",
    tests: "Tests",
    conformance: "Conformité",
    permissions: "Permissions",
  },
  tests: (passed: number, failed: number) =>
    `Tests : ${passed} réussi${passed > 1 ? "s" : ""}, ${failed} en échec`,
  missing: (p: string) => `  permission utilisée mais non déclarée : ${p}`,
  unused: (p: string) => `  permission déclarée mais inutilisée : ${p}`,
  valid: "Composant valide : il apparaît dans « Mes composants ».",
  invalid: "Composant invalide.",
  dev: (url: string) => `Aperçu : ${url} (Ctrl+C pour arrêter)`,
  noDaemon: "Le démon Kibo ne tourne pas : lance l'application Kibo, puis réessaie.",
  daemonInfoCorrupt: (file: string) =>
    `Le fichier ${file} est corrompu : relance l'application Kibo, ou supprime ce fichier puis réessaie.`,
  pairingFailed: "Appairage refusé : le jeton de ~/.kibo/token ne correspond pas.",
  strategyRequired: (n: number) =>
    `Ce composant est utilisé par ${n} instance${n > 1 ? "s" : ""} : ajoute --update-all ou --new-version.`,
  unchanged: "Rien à publier : cette version est déjà publiée avec le même code.",
  published: (version: string) => `Version ${version} publiée.`,
  needsApproval: "Autorisation requise : ouvre Kibo (écran « Composants ») pour l'accorder.",
  partial: (n: number) =>
    `${n} instance${n > 1 ? "s" : ""} restée${n > 1 ? "s" : ""} sur l'ancienne version :`,
  failedLine: (project: string, page: string, message: string) => `  ${project} › ${page} — ${message}`,
  error: (code: string, message: string) => `Erreur ${code} : ${message}`,
  daemonTooOld: (daemon: string, command: string) =>
    `Le démon ${daemon} est trop ancien pour kibo ${command} : mets Kibo à jour, puis réessaie.`,
  daemonError: (code: string, message: string, home: string, version: string | null) =>
    `Erreur ${code} : ${message} (démon ${home}, ${version ?? "version inconnue"})`,
  daemonName: (home: string, version: string | null) => `${home} (${version ?? "version inconnue"})`,
};
