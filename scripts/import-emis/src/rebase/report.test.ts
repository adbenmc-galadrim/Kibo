import { describe, expect, test } from "bun:test";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { readOldProject } from "./old-project";
import { buildRebasePlan } from "./plan-file";
import { renderReport } from "./report";
import { TODO_PLACEMENT } from "./todo-placement";

const old = readOldProject(emisShapedSnapshot());
const merges = [
  { number: 1, mergedAt: "2026-10-05T10:00:00Z" },
  { number: 2, mergedAt: "2026-10-06T10:00:00Z" },
  { number: 3, mergedAt: "2026-10-07T10:00:00Z" },
];
const plan = buildRebasePlan({ old, source: "getProject", merges, placement: TODO_PLACEMENT, overrides: {} });
const report = renderReport(plan);
const section = (title: string): string => {
  const start = report.indexOf(`## ${title}`);
  const end = report.indexOf("\n## ", start + 1);
  return report.slice(start, end < 0 ? undefined : end);
};
const rows = (text: string): string[] =>
  text.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| ---"));

describe("renderReport", () => {
  test("opens with the points to settle, then the TODO placement", () => {
    expect(report.indexOf("## À placer")).toBeLessThan(report.indexOf("## Placement de TODO"));
    const todo = rows(section("Placement de TODO"));
    expect(todo).toHaveLength(1 + 9);
    expect(todo).toContain(
      `| DATA-1 | ${old.tickets.find((t) => t.title.startsWith("DATA-1"))?.key} | question au client | F4 · Dossiers |`,
    );
    expect(
      todo.some((r) => r.startsWith("| DEV-1 |") && r.includes("étape EMIS-") && r.includes("F1 · Socle")),
    ).toBe(true);
  });

  test("maps every kept old key to its new key, feature and sprint", () => {
    const table = rows(section("Correspondance des clés"));
    expect(table).toHaveLength(1 + 100);
    expect(table[0]).toBe("| Ancienne clé | Nouvelle clé | Fonctionnalité | Sprint |");
    expect(table[1]).toBe("| EMIS-1 | F1 | F1 · Socle | S1 |");
    expect(table[2]).toBe("| EMIS-2 | EMIS-1 | F1 · Socle | S1 |");
    expect(table.some((r) => r.includes("| question (F4) |"))).toBe(true);
  });

  test("lists questions with their target, dropped links and dropped tickets", () => {
    const questions = rows(section("Questions"));
    expect(questions).toHaveLength(1 + 6);
    expect(
      questions.some((r) => r.startsWith("| Q5 |") && r.includes("| EMIS-") && r.includes("bloquante")),
    ).toBe(true);
    expect(rows(section("Liens tombés"))).toHaveLength(1 + 2);
    expect(section("Tickets non recréés")).toContain("Arbitrages n'est pas une fonctionnalité");
  });

  test("gives the observed velocity and its source", () => {
    expect(report).toContain(
      "Vitesse observée : 5 étapes par semaine (valeur par défaut : 3 étapes fusionnées sur 1 semaine, moins de deux semaines)",
    );
    expect(section("Vitesse")).toContain("| #3 | 2026-10-07 | 2026-W41 |");
  });

  test("plans each sprint with dates, features and step count, then expected counts", () => {
    const sprints = rows(section("Plan de sprints"));
    expect(sprints[0]).toBe("| Sprint | Dates | Fonctionnalités terminées | Étapes |");
    expect(sprints[1]).toBe("| S1 | 19 → 23 oct. 2026 | F1 · Socle | 5 |");
    const s1 = report.slice(report.indexOf("### S1 · 19 → 23 oct. 2026"), report.indexOf("### S2"));
    expect(s1).toContain("- EMIS-5 · Nettoyer les données de test (F1)");
    expect(s1.split("\n").filter((l) => l.startsWith("- EMIS-"))).toHaveLength(5);
    expect(s1).toContain("- Fonctionnalités terminées : F1 · Socle.");
    expect(sprints).toHaveLength(1 + plan.setup.sprintCount);
    expect(section("Plan de sprints")).toContain("Fin prévue :");
    const counts = section("Comptes attendus");
    expect(counts).toContain("Fonctionnalités : 15 (F1 à F15)");
    expect(counts).toContain("Étapes : 83 (EMIS-1 à EMIS-83, dont 7 venues de TODO)");
    expect(counts).toContain("Questions : 6 (dont 2 au client)");
  });
});
