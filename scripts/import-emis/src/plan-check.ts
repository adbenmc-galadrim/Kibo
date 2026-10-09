import { type EmisPlan, type FlatPr, flatPrs } from "./plan-source";

export const PLAN_ID = /\b[A-Z][A-Z\d]-\d+\b/g;
const sprintRank = (sprint: string): number | null => {
  const match = /^S(\d+)$/.exec(sprint);
  return match ? Number(match[1]) : null;
};

function checkPrs(plan: EmisPlan, prs: FlatPr[], fail: (m: string) => void): Map<string, FlatPr> {
  const phases = new Set(plan.phases.map((p) => p.id));
  const by = new Map<string, FlatPr>();
  for (const p of prs) {
    if (by.has(p.id)) fail(`identifiant en double : ${p.id}`);
    by.set(p.id, p);
    if (!p.id.startsWith(`${p.chapter}-`)) fail(`${p.id} rangée dans le chapitre ${p.chapter}`);
    if (!phases.has(p.phase)) fail(`${p.id} : phase inconnue « ${p.phase} »`);
    if (sprintRank(p.sprint) === null) fail(`${p.id} : sprint absent ou mal formé`);
    if (!p.why) fail(`${p.id} : pas de why`);
  }
  return by;
}

function checkDeps(plan: EmisPlan, prs: FlatPr[], by: Map<string, FlatPr>, fail: (m: string) => void): void {
  const phaseRank = new Map(plan.phases.map((p, i) => [p.id, i]));
  for (const p of prs)
    for (const d of p.deps) {
      const q = by.get(d);
      if (!q) {
        fail(`${p.id} dépend de ${d}, inconnue`);
        continue;
      }
      if ((phaseRank.get(q.phase) ?? -1) > (phaseRank.get(p.phase) ?? -1))
        fail(`${p.id} (${p.phase}) dépend de ${d} (${q.phase}), phase postérieure`);
      if ((sprintRank(q.sprint) ?? -1) > (sprintRank(p.sprint) ?? -1))
        fail(`${p.id} (${p.sprint}) dépend de ${d} planifiée plus tard (${q.sprint})`);
      if (p.status === "done" && q.status !== "done") fail(`${p.id} livrée alors que ${d} ne l'est pas`);
    }
}

function checkCycles(prs: FlatPr[], by: Map<string, FlatPr>, fail: (m: string) => void): void {
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, trail: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      fail(`cycle : ${[...trail, id].join(" → ")}`);
      return;
    }
    state.set(id, 1);
    for (const d of by.get(id)?.deps ?? []) if (by.has(d)) visit(d, [...trail, id]);
    state.set(id, 2);
  };
  for (const p of prs) visit(p.id, []);
}

function checkSprints(
  plan: EmisPlan,
  prs: FlatPr[],
  by: Map<string, FlatPr>,
  fail: (m: string) => void,
): void {
  const listed = new Map<string, string>();
  for (const s of plan.sprints)
    for (const id of `${s.main} ${s.parallel}`.match(PLAN_ID) ?? []) {
      const before = listed.get(id);
      if (before) fail(`${id} listée dans ${before} et ${s.id}`);
      listed.set(id, s.id);
    }
  for (const p of prs) {
    const sprint = listed.get(p.id);
    if (!sprint) fail(`${p.id} absente du tableau des sprints`);
    else if (sprint !== p.sprint) fail(`${p.id} : sprint ${p.sprint} mais listée en ${sprint}`);
  }
  for (const id of listed.keys()) if (!by.has(id)) fail(`${id} listée dans les sprints mais inconnue`);
}

function checkReferences(plan: EmisPlan, by: Map<string, FlatPr>, fail: (m: string) => void): void {
  for (const g of plan.arbitrages)
    for (const q of g.items)
      if (q.blocks && q.blocks !== "—" && !by.has(q.blocks)) fail(`${q.ref} bloque ${q.blocks}, inconnue`);
  for (const c of plan.criticalPath.chains)
    for (const id of c.steps) if (!by.has(id)) fail(`chemin critique « ${c.label} » : ${id} inconnue`);
}

export function checkPlan(plan: EmisPlan): string[] {
  const errors: string[] = [];
  const fail = (m: string) => errors.push(m);
  const prs = flatPrs(plan);
  const by = checkPrs(plan, prs, fail);
  checkDeps(plan, prs, by, fail);
  checkCycles(prs, by, fail);
  checkSprints(plan, prs, by, fail);
  checkReferences(plan, by, fail);
  return errors;
}
