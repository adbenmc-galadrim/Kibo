import { join } from "node:path";

const PLAN_FILE_RULE = /plan-data|plan-check/;

export function livraisonGuideline(process: readonly string[], notesDir: string): string {
  const rules = process.filter((r) => !PLAN_FILE_RULE.test(r));
  const briefs = `${join(notesDir, "briefs")}/`;
  return [
    "# Livraison d'un ticket Emis avec Kibo",
    "",
    "## Avant de coder",
    `- Lire le brief du ticket s'il existe : \`${briefs}<ID>.md\`, où \`<ID>\` est le préfixe du titre (\`C0-10\`).`,
    `- Lire la section de la passation citée par le ticket dans \`${join(notesDir, "metier", "passation")}/\`, et le lexique \`${join(notesDir, "metier", "lexique.md")}\`.`,
    "- Le périmètre, les tests et les pièges sont dans la description du ticket ; le découpage en commits dans le brief.",
    "",
    "## Règles du projet",
    ...rules.map((r) => `- ${r}`),
    "",
    "## Livrer",
    "- Porte qualité avant chaque push : `pnpm format:check`, `pnpm lint`, `pnpm check-types`, `pnpm test`.",
    "- Ouvrir la PR en draft vers `dev` : `gh pr create --draft --base dev`.",
    "- Un seul `pnpm test:e2e` ou `pnpm storybook` à la fois sur la machine.",
    "- Toute question passe par `ask_user` : ne jamais trancher une décision à la place d'Adam.",
    "- Ne jamais toucher `tmp/plan-data.js` : le plan vit dans Kibo, projet EMIS.",
    "",
  ].join("\n");
}
