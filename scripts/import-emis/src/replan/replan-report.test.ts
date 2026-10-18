import { describe, expect, test } from "bun:test";
import type { DeadlinePlan } from "./deadline-plan";
import { renderReplanReport } from "./replan-report";

const plan: DeadlinePlan = {
  deadline: "2026-11-05",
  remaining: 5,
  capacity: 2,
  sprints: [
    { id: "s1", code: "S1", start: "2026-10-19", end: "2026-10-23" },
    { id: "s2", code: "S2", start: "2026-10-26", end: "2026-11-05" },
  ],
  dropped: [{ id: "s3", code: "S3", start: "2026-11-09", end: "2026-11-13" }],
  steps: [
    { key: "EMIS-2", feature: "F1", sprint: 1 },
    { key: "EMIS-4", feature: "F1", sprint: 1 },
    { key: "EMIS-5", feature: "F2", sprint: 2 },
  ],
  forced: [],
  features: [
    { key: "F1", from: "S3", to: "S1" },
    { key: "F2", from: "S3", to: "S2" },
  ],
  commands: [{ method: "deleteSprint", sprintId: "s3" }],
};
const titles = new Map([
  ["F1", "Socle"],
  ["F2", "Auth"],
  ["EMIS-2", "Hébergement"],
  ["EMIS-4", "Staging"],
  ["EMIS-5", "SSO"],
]);

describe("renderReplanReport", () => {
  const report = renderReplanReport(plan, titles, 1);

  test("states the deadline, the capacity and how far it is from the observed velocity", () => {
    expect(report).toContain("# Replanification d'Emis · fin le 5 nov. 2026");
    expect(report).toContain("- Capacité : 2 étapes par sprint (vitesse observée : 1, soit ×2)");
  });

  test("lists each sprint with the features it ends and its steps", () => {
    expect(report).toContain("| S1 | 19 → 23 oct. 2026 | F1 · Socle | 2 |");
    expect(report).toContain("- EMIS-5 · SSO (F2)");
    expect(report).toContain("| F2 · Auth | S3 | S2 |");
    expect(report).toContain("- S3 (9 → 13 nov. 2026)");
  });
});
