import type { EmisPlan } from "./plan-source";

const bullets = (items: readonly string[]) => items.map((i) => `- ${i}`).join("\n");
const doc = (...blocks: string[]) => `${blocks.filter((b) => b.trim() !== "").join("\n\n")}\n`;

export function planNote(plan: EmisPlan): string {
  const deadline = plan.meta.deadline
    ? `**${plan.meta.deadline.label}** : ${plan.meta.deadline.date}. ${plan.meta.deadline.note}`
    : "";
  return doc(
    `# ${plan.meta.title}`,
    plan.meta.subtitle,
    deadline,
    "## Phases",
    ...plan.phases.map((p) => `### ${p.id} · ${p.label}\n\n${p.goal}\n\n${p.note}`.trimEnd()),
    "## Chapitres",
    ...plan.chapters.map(
      (c) =>
        `### ${c.id} · ${c.title}\n\n${c.tagline}\n\n${bullets(c.prs.map((p) => `${p.id} · ${p.title}`))}`,
    ),
  );
}

export const decisionsNote = (plan: EmisPlan): string =>
  doc("# Décisions", ...plan.decisions.map((d) => `## ${d.id} · ${d.title}\n\n${bullets(d.body)}`));

export const etatNote = (plan: EmisPlan): string =>
  doc("# État", "## Livré", bullets(plan.etat.livre), "## Manquant", bullets(plan.etat.manquant));

export function sprintsNote(plan: EmisPlan): string {
  const rows = plan.sprints.map((s) => `| ${s.id} | ${s.from} | ${s.main} | ${s.parallel} |`);
  return doc(
    "# Sprints",
    `Premier sprint : ${plan.meta.firstSprintDate}.`,
    ["| Sprint | Début | Principal | En parallèle |", "|---|---|---|---|", ...rows].join("\n"),
    plan.sprintNote,
  );
}

export const criticalPathNote = (plan: EmisPlan): string =>
  doc(
    "# Chemin critique",
    "## Chaînes",
    bullets(
      plan.criticalPath.chains.map(
        (c) => `**${c.label}** : ${c.steps.join(" → ")}${c.then ? ` → ${c.then}` : ""}`,
      ),
    ),
    "## Verrous",
    bullets(plan.criticalPath.verrous.map((v) => `**${v.label}** : ${v.text}`)),
  );

export const processNote = (plan: EmisPlan): string => doc("# Processus", bullets(plan.process));

export const depotNote = (readmes: readonly string[]): string =>
  doc(
    "# Dépôt",
    "Les README du dépôt vivent sur leurs branches et ne sont pas copiés ici. Les lire dans le worktree du ticket :",
    readmes.length > 0
      ? bullets(readmes.map((r) => `\`${r}\``))
      : "Aucun README trouvé au moment de l'import.",
  );
