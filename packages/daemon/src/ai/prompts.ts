import { type DraftKind, type DraftMode, PageKind, type Role, type ValidationReport } from "@kibo/schema";
import type { CatalogEntry } from "./ports";

export const STARTER_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pages"],
  properties: {
    pages: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "kind", "components"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 40 },
          kind: { type: "string", enum: PageKind.options },
          components: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id"],
              properties: { id: { type: "string", minLength: 1 }, config: { type: "object" } },
            },
          },
        },
      },
    },
  },
} as const;

const ROLE_LABEL: Record<Role, string> = {
  dev: "Développeur·se",
  designer: "Designer",
  pm: "Chef·fe de projet",
  other: "Autre",
};
const KIND_LABEL = { widget: "widget", view: "vue", both: "widget et vue" } as const;
const OUTPUT_TAIL = 4000;

export function assistantPrompt(input: { role: Role; text: string; catalog: CatalogEntry[] }): string {
  const catalog = input.catalog
    .map((c) => `- ${c.id} — ${c.title} — ${c.kind} — ${c.description}`)
    .join("\n");
  return [
    "Tu configures l'espace de départ d'un projet dans Kibo, un outil local de gestion de projets de code.",
    `Rôle de l'utilisateur : ${ROLE_LABEL[input.role]}.`,
    `Son usage, dans ses mots : « ${input.text} ».`,
    "",
    "Composants installés (id — titre — type — description) :",
    catalog,
    "",
    'Types de page : "dashboard" (tableau de bord : une grille de widgets) et "view" (un seul composant en plein écran).',
    "Propose entre 1 et 8 pages utiles pour cet usage. Une page view contient exactement un composant.",
    "N'utilise que les id de la liste. Titres en français, 40 caractères au plus.",
    'Réponds uniquement par un objet JSON de la forme {"pages":[{"title":"…","kind":"dashboard","components":[{"id":"…","config":{}}]}]}, sans aucun texte autour.',
  ].join("\n");
}

export type GeneratorBrief = {
  mode: DraftMode;
  componentId: string;
  title: string;
  kind: DraftKind;
  withServer: boolean;
  description: string;
  baseVersion: string | null;
  attachments: readonly string[];
};

const writable = (b: GeneratorBrief) =>
  b.withServer ? "ui.tsx, server.ts et des fichiers *.test.tsx" : "ui.tsx et des fichiers *.test.tsx";

const TEST_ORDER = "Lance `kibo component test .` avant de t'arrêter, et corrige jusqu'à ce qu'il passe.";

const imageLines = (paths: readonly string[]): string[] =>
  paths.length === 0
    ? []
    : ["", "Maquettes jointes (lis chaque image avant de coder) :", ...paths.map((p) => `- ${p}`)];

export function generatorPrompt(b: GeneratorBrief): string {
  const task =
    b.mode === "create"
      ? `Écris le composant Kibo « ${b.title} » (id ${b.componentId}, ${KIND_LABEL[b.kind]}) dans le dossier courant.`
      : `Modifie le composant Kibo « ${b.title} » (${b.componentId}@${b.baseVersion ?? "?"}) dans le dossier courant.`;
  return [
    task,
    `Demande de l'utilisateur : « ${b.description} »`,
    ...imageLines(b.attachments),
    "",
    "Avant de commencer, lis CLAUDE.md et le skill kibo-component du dossier.",
    `Tu ne modifies que ${writable(b)} ; component.test.tsx garde l'appel à runConformance.`,
    "N'importe que @kibo/sdk (et ses sous-chemins), react et lucide-react ; les tests ajoutent bun:test et @testing-library/react.",
    "Tu ne peux pas changer le manifeste ni la forme de la config : si c'est nécessaire, arrête-toi et explique pourquoi.",
    TEST_ORDER,
  ].join("\n");
}

export function revisePrompt(b: GeneratorBrief, feedback: string, attachments: readonly string[]): string {
  return [
    `Retour de l'utilisateur après aperçu : « ${feedback} »`,
    ...imageLines(attachments),
    "",
    `Reprends le composant « ${b.title} » (${b.componentId}) dans le dossier courant pour tenir compte de ce retour.`,
    `Tu ne modifies que ${writable(b)}.`,
    TEST_ORDER,
  ].join("\n");
}

const tail = (s: string) => (s.length > OUTPUT_TAIL ? s.slice(-OUTPUT_TAIL) : s);

export function fixPrompt(report: ValidationReport): string {
  const steps: [string, boolean, string][] = [
    ["Manifeste", report.manifest.ok, report.manifest.errors.join("\n")],
    ["Imports", report.imports.ok, report.imports.errors.join("\n")],
    ["Typecheck", report.typecheck.ok, report.typecheck.errors.join("\n")],
    ["Tests", report.tests.ok, report.tests.output],
    ["Conformité", report.conformance.ok, report.conformance.errors.join("\n")],
  ];
  const sections = steps.filter(([, ok]) => !ok).map(([name, , text]) => `## ${name}\n${tail(text)}`);
  const p = report.permissions;
  if (p.missing.length > 0 || p.errors.length > 0)
    sections.push(
      `## Permissions\n${[...p.missing.map((m) => `Utilisée mais non déclarée : ${m}`), ...p.errors].join("\n")}`,
    );
  return [
    "La validation de Kibo a échoué. Rapport :",
    "",
    ...sections,
    "",
    "Corrige le code, puis relance `kibo component test .` avant de t'arrêter.",
  ].join("\n");
}

const SKILL = `---
name: kibo-component
description: Écrire, tester et corriger un composant Kibo avec le SDK public.
---

# Composant Kibo

Un composant exporte \`Component\` depuis \`ui.tsx\`. Son manifeste \`kibo.component.json\` est écrit par Kibo.

## API du SDK (\`@kibo/sdk\`)

- \`useEntities("ticket" | "status" | "link" | "page" | "run" | "note" | "ci_run")\` : \`{ data, error, loading }\`, rechargé à chaque changement.
- \`useSdk()\` : \`{ instanceId, config, viewer, surface, list, run, subscribe, openTicket, openNewTicket, openFile, openView, data, fetch, action, notes, mcp }\`.
- \`sdk.run({ method: "createTicket", title })\`, \`sdk.run({ method: "setStatus", ticketId, statusId })\` : commandes du projet.
- \`sdk.data.get/set/delete/keys\` : données privées de l'instance (256 Kio).
- \`sdk.fetch("https://hôte/chemin")\` : HTTPS via le démon, réponse \`{ status, headers, body }\` (\`body\` texte) ; l'URL doit être un littéral.
- \`StatusDot({ statusId })\` et les primitives shadcn : \`@kibo/sdk/ui/button\`, \`card\`, \`badge\`, \`input\`, \`select\`, \`dialog\`…
- Serveur (\`server.ts\`, si présent) : \`defineServer({ actions, jobs })\` depuis \`@kibo/sdk/server\`.

Chaque argument de \`useEntities\`, \`sdk.list\`, \`sdk.run\`, \`sdk.fetch\` est un littéral : Kibo en déduit les permissions.

## Tests

- \`component.test.tsx\` importe \`runConformance\` de \`@kibo/sdk/conformance\` et appelle \`runConformance({ manifest, Component })\` : ne le retire pas.
- Ajoute tes tests dans des fichiers \`*.test.tsx\` avec \`createMockSdk(manifest, { seed })\` de \`@kibo/sdk/mock\` et \`@testing-library/react\`.
- Commande : \`kibo component test .\` (typecheck, tests, conformité, permissions).
`;

export function draftKiboFiles(b: GeneratorBrief): Record<string, string> {
  const rules = `# Règles du brouillon « ${b.title} »

- Fichiers que tu peux écrire : ${writable(b)}, à la racine du dossier.
- Tout autre fichier appartient à Kibo : une modification est annulée à la fin du run.
- Imports autorisés : chemins relatifs, \`@kibo/sdk\` et ses sous-chemins, \`react\`, \`lucide-react\` ; dans les tests, aussi \`bun:test\` et \`@testing-library/react\`.
- Pas de réseau direct, pas de \`node:*\`, \`bun:*\` ni \`bun\` : tout passe par le SDK.
- \`component.test.tsx\` garde l'appel à \`runConformance\`.
- Textes affichés en français, en tutoyant l'utilisateur.
- Termine par \`kibo component test .\` : il doit passer.
`;
  return { "CLAUDE.md": rules, ".claude/skills/kibo-component/SKILL.md": SKILL };
}
