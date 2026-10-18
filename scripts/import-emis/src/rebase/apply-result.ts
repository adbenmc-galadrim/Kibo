import { type BackupInfo, DEFAULT_RECIPIENTS, type ProjectSnapshot, type Rule } from "@kibo/schema";
import type { RebasePlan } from "./plan-file";

export type ResultInput = {
  plan: RebasePlan;
  backup: BackupInfo;
  backupDir: string;
  oldId: string;
  old: ProjectSnapshot;
  newId: string | null;
  fresh: ProjectSnapshot | null;
  copied: readonly string[];
  notCopied: readonly string[];
  problems: readonly string[];
  failure: string | null;
};

function verdict(input: ResultInput): string[] {
  if (input.failure !== null) {
    const kept = input.newId
      ? `Le projet neuf ${input.newId} est conservé, incomplet : le supprimer, puis relancer \`--dry-run\`, ou restaurer à froid.`
      : "Aucun projet neuf n'a été créé : restaurer à froid.";
    const stage = input.failure.includes("key check") ? "à la vérification des clés" : "pendant le semis";
    return [`**Arrêt ${stage}** : ${input.failure}`, "", kept];
  }
  if (input.problems.length === 0) return ["**Conforme** : rien de perdu, rien d'inventé."];
  return [`**${input.problems.length} écart(s)** :`, "", ...input.problems.map((p) => `- ${p}`)];
}

function counts(fresh: ProjectSnapshot | null): string[] {
  if (fresh === null) return ["Aucun projet neuf à compter."];
  const features = fresh.tickets.filter((t) => t.parentId === null).length;
  return [
    `- pages : ${fresh.pages.length}`,
    `- sprints : ${fresh.sprints.length}`,
    `- fonctionnalités : ${features}`,
    `- étapes : ${fresh.tickets.length - features}`,
    `- liens : ${fresh.links.length}`,
    `- questions : ${fresh.questions.length}`,
    `- client : ${fresh.meta.client ?? "aucun"}`,
  ];
}

const DEFAULT_RECIPIENT_IDS = new Set(DEFAULT_RECIPIENTS.map((r) => r.id));

const ruleSignature = (r: Rule): string => JSON.stringify([r.enabled, r.when, [...r.from].sort(), r.to]);

export function notTransferred(old: ProjectSnapshot, fresh: ProjectSnapshot | null): string[] {
  const freshRules = new Set((fresh?.rules ?? []).map(ruleSignature));
  const rules = old.rules.filter((r) => !freshRules.has(ruleSignature(r)));
  const pages = old.pages.map((p) => p.title);
  const recipients = old.questionRecipients.filter((r) => !DEFAULT_RECIPIENT_IDS.has(r.id));
  const domains = old.domains?.length ?? 0;
  return [
    ...(pages.length > 0
      ? [
          `Pages et instances de l'ancien projet (${pages.join(", ")}) : remplacées par les cinq pages du nouveau projet.`,
        ]
      : []),
    ...(old.icon ? ["Icône du projet : à reposer dans « Modifier le projet »."] : []),
    ...(domains > 0 ? [`${domains} domaine(s) et leurs guidelines.`] : []),
    ...(rules.length > 0 ? [`${rules.length} règle(s) d'automatisation propres à l'ancien projet.`] : []),
    ...(old.bindings.length > 0 ? [`${old.bindings.length} liaison(s) de composant.`] : []),
    ...(recipients.length > 0
      ? [`Destinataires de questions ajoutés : ${recipients.map((r) => r.name).join(", ")}.`]
      : []),
    ...(old.sync.shared ? ["Partage du projet : à refaire depuis « Partager »."] : []),
    "L'historique de l'agent de projet, le journal `project_events` et l'historique d'édition des questions : ils restent dans la sauvegarde.",
  ];
}

export function renderResult(input: ResultInput): string {
  const keys = [...input.plan.mapping.keys.entries()].map(([from, to]) => `| ${from} | ${to} |`);
  const copied = input.copied.length > 0 ? input.copied.join(", ") : "aucun";
  return [
    "# Rebase d'Emis · résultat",
    "",
    `- Sauvegarde : ${input.backup.id} (${input.backupDir}, ${input.backup.bytes} octets)`,
    `- Ancien projet : ${input.oldId} (supprimé)`,
    `- Nouveau projet : ${input.newId ?? "non créé"}`,
    `- Empreinte du plan : ${input.plan.fingerprint.slice(0, 12)}`,
    `- Réglages recopiés : ${copied}`,
    "",
    "## Vérification",
    "",
    ...verdict(input),
    "",
    "## Comptes",
    "",
    ...counts(input.fresh),
    "",
    "## Clés",
    "",
    "| Ancienne clé | Nouvelle clé |",
    "|---|---|",
    ...keys,
    "",
    "## Non transféré",
    "",
    ...[...input.notCopied, ...notTransferred(input.old, input.fresh)].map((line) => `- ${line}`),
    "",
    "## Restauration à froid",
    "",
    "1. Quitter Kibo (le démon s'arrête avec l'application).",
    `2. Recopier le contenu de \`${input.backupDir}\` (\`kibo.db\`, \`runs.db\`, \`components/\`, \`notes/\`) dans le dossier du démon (\`$KIBO_HOME\`, défaut \`~/.kibo\`).`,
    "3. Relancer Kibo.",
    "",
  ].join("\n");
}
