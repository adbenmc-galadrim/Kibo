import type { Assignee } from "@kibo/schema";
import type { FeatureRef, SprintRef } from "./tickets/ticket-tracking";
import type { PrSummary, TicketRef } from "./tickets/ticket-view";

const MARKET_USAGE = [
  "  kibo market keygen --out <fichier>",
  "  kibo market pack <id>@<version> [--out <fichier>] [--publisher <nom>]",
  "  kibo market index --dir <dossier> --key <fichier> --id <source> --name <nom> [--verify <clés>]",
];

const TICKETS_USAGE = [
  "  kibo tickets list --project <clé|nom|id> [--ready] [--status <s>[,<s>…]] [--sprint <id|code|nom|current|none>] [--json]",
  "  kibo tickets get <clé|id du plan> --project <p> [--json]",
  "  kibo tickets set <clé|id du plan> [status=<todo|wip|done|blocked>] [pr=<n|url>] [branch=<nom> [base=<nom>]] [reason=<texte>] --project <p> [--json]",
  "  kibo tickets step <clé> <0-11> [note] [--json]",
];

const SPRINTS_USAGE = ["  kibo sprints list --project <clé|nom|id> [--json]"];

const PROJECTS_USAGE = ["  kibo projects list [--json]", "  kibo projects get <clé|nom|id> [--json]"];

const ref = (r: TicketRef) => `${r.key}${r.planId ? ` (${r.planId}, ${r.status})` : ` (${r.status})`}`;
const refs = (list: TicketRef[]) => (list.length === 0 ? "aucun" : list.map(ref).join(", "));

export const frTickets = {
  usage: ["Usage :", ...TICKETS_USAGE].join("\n"),
  notRunning: "Kibo n'est pas lancé : ouvre l'application Kibo, puis réessaie.",
  projectNotFound: (p: string) => `Projet introuvable : ${p}`,
  ticketNotFound: (id: string) => `Ticket introuvable : ${id}`,
  sprintNotFound: (name: string) => `Sprint introuvable : ${name}`,
  notesUnavailable: "Notes liées indisponibles : ce démon Kibo est plus ancien que la commande kibo.",
  defaultBlockedReason: "Bloqué par la livraison (kibo tickets)",
  updated: (key: string, changes: string[]) =>
    `✓ ${key} : ${changes.length === 0 ? "déjà à jour" : changes.join(" ")}`,
  status: (status: string, column: string) => `Statut : ${status} (${column})`,
  blocked: (reason: string) => `Raison du blocage : ${reason}`,
  parent: (r: TicketRef | null) => `Parent : ${r ? ref(r) : "aucun"}`,
  sprint: (s: SprintRef | null) => `Sprint : ${s ? `${s.code} · ${s.name}` : "aucun"}`,
  feature: (f: FeatureRef | null) =>
    `Fonctionnalité : ${f ? [f.shortKey, f.key, f.title].filter((part) => part !== null).join(" · ") : "aucune"}`,
  optional: "Étape facultative",
  children: (list: TicketRef[]) => `Enfants : ${refs(list)}`,
  deps: (list: TicketRef[]) => `Dépendances : ${refs(list)}`,
  pr: (pr: PrSummary | null) => `PR : ${pr ? `#${pr.number} (${pr.state}) ${pr.url}` : "aucune"}`,
  assignee: (a: Assignee | null) =>
    `Assigné : ${a ? `${a.kind === "agent" ? "agent" : "humain"} ${a.ref}` : "personne"}`,
  labels: (labels: string[]) => `Étiquettes : ${labels.length === 0 ? "aucune" : labels.join(", ")}`,
  brief: (path: string | null) => `Brief : ${path ?? "aucun"}`,
  notes: (paths: string[]) => `Notes : ${paths.length === 0 ? "aucune" : paths.join(", ")}`,
  questions: (n: number) => (n === 0 ? "Questions : aucune" : "Questions :"),
  question: (state: string, title: string, recipient: string, blocking: boolean) =>
    `  - [${state}] ${title} → ${recipient}${blocking ? " (bloquante)" : ""}`,
  description: "Description :",
  stepOutOfRange: (step: string) => `Étape invalide : ${step} (étape entre 0 et 11)`,
  stepDone: (key: string, label: string) => `✓ ${key} : ${label}`,
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
};
