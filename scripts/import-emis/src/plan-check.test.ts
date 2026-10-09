import { expect, test } from "bun:test";
import { join } from "node:path";
import { checkPlan } from "./plan-check";
import { type EmisPlan, loadPlan, type PlanPr } from "./plan-source";

const PLAN = loadPlan(join(import.meta.dir, "..", "fixtures", "emis", "tmp", "plan-data.js"));

function withPr(id: string, patch: Partial<PlanPr>, plan: EmisPlan = PLAN): EmisPlan {
  return {
    ...plan,
    chapters: plan.chapters.map((c) => ({
      ...c,
      prs: c.prs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  };
}

test("the fixture plan is valid", () => {
  expect(checkPlan(PLAN)).toEqual([]);
});

test("a dependency planned later, then a cycle, are reported", () => {
  const later = withPr("C1-2", { deps: ["C1-3"] });
  expect(checkPlan(later)).toContain("C1-2 (S2) dépend de C1-3 planifiée plus tard (S3)");
  expect(checkPlan(later)).toContain("C1-2 (P1) dépend de C1-3 (P2), phase postérieure");
  const cycle = withPr("C1-3", { deps: ["C1-2"] }, later);
  expect(checkPlan(cycle).some((e) => e.startsWith("cycle : "))).toBe(true);
});

test("identifiers, phases, sprints and why are checked", () => {
  expect(checkPlan(withPr("C0-2", { id: "C0-1" }))).toContain("identifiant en double : C0-1");
  expect(checkPlan(withPr("C1-1", { id: "C0-9" }))).toContain("C0-9 rangée dans le chapitre C1");
  expect(checkPlan(withPr("C1-1", { phase: "P9" }))).toContain("C1-1 : phase inconnue « P9 »");
  expect(checkPlan(withPr("C1-1", { sprint: "demain" }))).toContain("C1-1 : sprint absent ou mal formé");
  expect(checkPlan(withPr("C1-1", { why: "" }))).toContain("C1-1 : pas de why");
  expect(checkPlan(withPr("C1-1", { deps: ["C7-7"] }))).toContain("C1-1 dépend de C7-7, inconnue");
  expect(checkPlan(withPr("C1-2", { status: "done" }))).toContain("C1-2 livrée alors que C1-1 ne l'est pas");
});

test("a question blocking an unknown pr is reported", () => {
  const plan: EmisPlan = {
    ...PLAN,
    arbitrages: PLAN.arbitrages.map((g) => ({
      ...g,
      items: g.items.map((q) => (q.ref === "Q1" ? { ...q, blocks: "C9-9" } : q)),
    })),
  };
  expect(checkPlan(plan)).toEqual(["Q1 bloque C9-9, inconnue"]);
});

test("the sprint table and the critical path must match the prs", () => {
  const missing: EmisPlan = { ...PLAN, sprints: PLAN.sprints.filter((s) => s.id !== "S3") };
  expect(checkPlan(missing)).toEqual(["C1-3 absente du tableau des sprints"]);
  const moved = withPr("C1-2", { sprint: "S1" });
  expect(checkPlan(moved)).toContain("C1-2 : sprint S1 mais listée en S2");
  const twice: EmisPlan = {
    ...PLAN,
    sprints: PLAN.sprints.map((s) => (s.id === "S2" ? { ...s, parallel: "C0-2, C8-1" } : s)),
  };
  expect(checkPlan(twice)).toEqual(
    expect.arrayContaining(["C0-2 listée dans S1 et S2", "C8-1 listée dans les sprints mais inconnue"]),
  );
  const chain: EmisPlan = {
    ...PLAN,
    criticalPath: {
      ...PLAN.criticalPath,
      chains: PLAN.criticalPath.chains.map((c) => ({ ...c, steps: ["C5-5"] })),
    },
  };
  expect(checkPlan(chain)).toEqual(["chemin critique « Connexion » : C5-5 inconnue"]);
});
