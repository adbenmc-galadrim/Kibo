import {
  type ComponentFormat,
  type DraftKind,
  type DraftMode,
  PageKind,
  type Role,
  type Template,
  type ValidationReport,
} from "@kibo/schema";
import type { CatalogEntry } from "./ports";
import { EXAMPLE_COMPONENT, formatLine, formatTable, SKILL } from "./prompts-skill";

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
  formats: readonly ComponentFormat[];
  attachments: readonly string[];
  template: Template;
};

const TEMPLATE_LABELS: Record<Template, string> = {
  blank: "Vide",
  "3d": "3D",
  game: "Jeu",
  chart: "Graphique",
  table: "Tableau",
};

const templateLines = (t: Template): string[] =>
  t === "blank"
    ? []
    : [
        `Le gabarit ${TEMPLATE_LABELS[t]} est déjà en place dans \`ui.tsx\` : pars de là, garde ses conventions.`,
      ];

const IMPORTS_LINE =
  "N'importe que `@kibo/sdk` (et ses sous-chemins), `react`, `lucide-react` ; avec la capacité `webgl` : `three`, `three/addons/*` ; les tests ajoutent `bun:test` et `@testing-library/react`.";

const SKILL_DIR = ".claude/skills/kibo-component";

const writable = (b: GeneratorBrief) =>
  b.withServer ? "ui.tsx, server.ts et des fichiers *.test.tsx" : "ui.tsx et des fichiers *.test.tsx";

const TEST_ORDER = "Lance `kibo component test .` avant de t'arrêter, et corrige jusqu'à ce qu'il passe.";

const formatsLine = (b: GeneratorBrief) =>
  `Formats à prendre en charge : ${b.formats.map(formatLine).join(" ; ")}.`;

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
    formatsLine(b),
    ...templateLines(b.template),
    ...imageLines(b.attachments),
    "",
    `Avant de commencer, lis CLAUDE.md, le skill kibo-component du dossier et son exemple ${SKILL_DIR}/exemple.tsx.`,
    "Le composant s'adapte à chaque format avec sdk.format et les variantes de conteneur, sans largeur fixe.",
    `Tu ne modifies que ${writable(b)} ; component.test.tsx garde l'appel à runConformance.`,
    IMPORTS_LINE,
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
    formatsLine(b),
    `Tu ne modifies que ${writable(b)} ; les règles de CLAUDE.md et du skill kibo-component restent valables.`,
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

export function draftKiboFiles(b: GeneratorBrief): Record<string, string> {
  const rules = `# Règles du brouillon « ${b.title} »

- Fichiers que tu peux écrire : ${writable(b)}, à la racine du dossier.
- Tout autre fichier appartient à Kibo : une modification est annulée à la fin du run.
- Imports autorisés : chemins relatifs, \`@kibo/sdk\` et ses sous-chemins, \`react\`, \`lucide-react\` ; avec la capacité \`webgl\` : \`three\`, \`three/addons/*\` ; dans les tests, aussi \`bun:test\` et \`@testing-library/react\`.
- Pas de réseau direct, pas de \`node:*\`, \`bun:*\` ni \`bun\` : tout passe par le SDK.
- \`component.test.tsx\` garde l'appel à \`runConformance\`.
- Textes affichés en français, en tutoyant l'utilisateur.
- Formats déclarés : ${b.formats.join(", ")} ; le skill \`kibo-component\` donne leurs tailles, les jetons de style et les règles responsives.
- Exemple complet à suivre : \`${SKILL_DIR}/exemple.tsx\`.
- Termine par \`kibo component test .\` : il doit passer.
`;
  return {
    "CLAUDE.md": rules,
    [`${SKILL_DIR}/SKILL.md`]: `${SKILL}\n## Formats de ce composant\n\n${formatTable(b.formats)}\n`,
    [`${SKILL_DIR}/exemple.tsx`]: EXAMPLE_COMPONENT,
  };
}
