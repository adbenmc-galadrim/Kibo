import { rangeLabel } from "../rebase/report";
import type { DeadlinePlan } from "./deadline-plan";

const row = (cells: readonly string[]): string =>
  `| ${cells.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
const table = (head: readonly string[], body: readonly string[][]): string[] => [
  row(head),
  row(head.map(() => "---")),
  ...body.map(row),
];
const ratio = (a: number, b: number): string => (Math.round((a / b) * 10) / 10).toString().replace(".", ",");

function dayLabel(date: string): string {
  const range = rangeLabel(date, date);
  return range.slice(range.indexOf("→") + 2);
}

function capacityLine(plan: DeadlinePlan, observed: number | null): string {
  const gap =
    observed === null ? "" : ` (vitesse observée : ${observed}, soit ×${ratio(plan.capacity, observed)})`;
  return `- Capacité : ${plan.capacity} étapes par sprint${gap}`;
}

function sprintRows(plan: DeadlinePlan, titles: ReadonlyMap<string, string>): string[][] {
  return plan.sprints.map((s, i) => {
    const ending = plan.features
      .filter((f) => f.to === s.code)
      .map((f) => `${f.key} · ${titles.get(f.key) ?? ""}`);
    const count = plan.steps.filter((x) => x.sprint === i + 1).length;
    return [s.code, rangeLabel(s.start, s.end), ending.join(", ") || "—", String(count)];
  });
}

function sprintDetails(plan: DeadlinePlan, titles: ReadonlyMap<string, string>): string[] {
  return plan.sprints.flatMap((s, i) => [
    "",
    `### ${s.code} · ${rangeLabel(s.start, s.end)}`,
    "",
    ...plan.steps
      .filter((x) => x.sprint === i + 1)
      .map((x) => `- ${x.key} · ${titles.get(x.key) ?? ""} (${x.feature})`),
  ]);
}

export function renderReplanReport(
  plan: DeadlinePlan,
  titles: ReadonlyMap<string, string>,
  observed: number | null,
): string {
  const first = plan.sprints[0];
  const last = plan.sprints.at(-1);
  return [
    `# Replanification d'Emis · fin le ${dayLabel(plan.deadline)}`,
    "",
    `- Étapes restantes : ${plan.remaining} (hors terminées et facultatives)`,
    `- Sprints : ${plan.sprints.length} (${first?.code ?? "—"} à ${last?.code ?? "—"}, du ${first ? dayLabel(first.start) : "—"} au ${last ? dayLabel(last.end) : "—"})`,
    capacityLine(plan, observed),
    `- Étapes placées avant leurs dépendances : ${plan.forced.join(", ") || "aucune"}`,
    `- Commandes : ${plan.commands.length}`,
    "",
    "## Sprints",
    "",
    ...table(["Sprint", "Dates", "Fonctionnalités terminées", "Étapes"], sprintRows(plan, titles)),
    "",
    "## Fonctionnalités",
    "",
    ...table(
      ["Fonctionnalité", "Avant", "Après"],
      plan.features.map((f) => [`${f.key} · ${titles.get(f.key) ?? ""}`, f.from ?? "—", f.to]),
    ),
    "",
    "## Sprints supprimés",
    "",
    ...(plan.dropped.length === 0
      ? ["Aucun."]
      : plan.dropped.map((s) => `- ${s.code} (${rangeLabel(s.start, s.end)})`)),
    "",
    "## Détail",
    ...sprintDetails(plan, titles),
    "",
  ].join("\n");
}
