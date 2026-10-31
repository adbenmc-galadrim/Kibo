import { afterEach, describe, expect, test } from "bun:test";
import { KiboError, type PlanAction } from "@kibo/schema";
import { type Harness, harness } from "../project-agent/fakes.test-helper";
import type { ProjectAgentDataPort } from "../project-agent/types";
import { createPlanService } from "./plan-service";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});
const setup = () => {
  const h = harness();
  open.push(h);
  return h;
};

const why = "";
const featureAndSteps: PlanAction[] = [
  { id: 1, why, type: "createTicket", ref: "new:1", title: "Tournée et dépôt", feature: true },
  { id: 2, why, type: "createTicket", ref: "new:2", title: "Saisir la tournée", parent: "new:1" },
  { id: 3, why, type: "createTicket", ref: "new:3", title: "Déposer le lot", parent: "new:1" },
];

const fullPlan: PlanAction[] = [
  {
    id: 1,
    why,
    type: "createSprint",
    code: "S50",
    name: "Sprint 50",
    start: "2026-11-02",
    end: "2026-11-13",
  },
  { id: 2, why, type: "createTicket", ref: "new:1", title: "Tournée et dépôt", feature: true },
  { id: 3, why, type: "createTicket", ref: "new:2", title: "Saisir la tournée", parent: "new:1" },
  { id: 4, why, type: "createTicket", ref: "new:3", title: "Déposer le lot", parent: "new:1" },
  { id: 5, why, type: "link", from: "new:2", to: "new:3", kind: "blocks" },
  { id: 6, why, type: "setSprint", ticket: "new:1", sprint: "S50" },
  { id: 7, why, type: "createQuestion", ticket: "new:2", title: "Quel format de tournée ?" },
];

const outcomes = (results: { outcome: string }[]) => results.map((r) => r.outcome);

function failingAt(data: ProjectAgentDataPort, nth: number): ProjectAgentDataPort {
  let calls = 0;
  return {
    ...data,
    runCommand(projectId, command) {
      calls += 1;
      if (calls === nth) throw new KiboError("INVALID_INPUT", "boom");
      return data.runCommand(projectId, command);
    },
  };
}

describe("plan service", () => {
  test("a valid plan creates a feature, its steps, a link, a sprint and a question in order", async () => {
    const h = setup();
    const outcome = await createPlanService({ data: h.data }).apply(h.project.id, fullPlan);
    expect(outcome.problems).toEqual([]);
    expect(outcomes(outcome.results)).toEqual(Array(7).fill("applied"));
    expect(outcome.stoppedAt).toBeNull();
    expect(outcome.created.map((c) => [c.ref, c.key])).toEqual([
      ["new:1", "F1"],
      ["new:2", "SILO-1"],
      ["new:3", "SILO-2"],
    ]);
    const project = h.data.project(h.project.id);
    const byKey = (key: string) => project.tickets.find((t) => t.key === key);
    const sprint = project.sprints.find((s) => s.code === "S50");
    expect(byKey("SILO-2")?.waitingOn).toEqual(["SILO-1"]);
    expect(byKey("F1")?.effectiveSprintId).toBe(sprint?.id ?? "-");
    const question = project.questions.find((q) => q.title === "Quel format de tournée ?");
    expect(question?.ticketId).toBe(byKey("SILO-1")?.id ?? "-");
    expect(question?.createdBy).toEqual({ kind: "human", ref: "adam" });
  });

  test("preview predicts the keys apply will give", async () => {
    const h = setup();
    const service = createPlanService({ data: h.data });
    const first = { "new:1": "F1", "new:2": "SILO-1", "new:3": "SILO-2" };
    expect(service.preview(h.project.id, featureAndSteps)).toEqual({ ok: true, keys: first });
    const outcome = await service.apply(h.project.id, featureAndSteps);
    expect(Object.fromEntries(outcome.created.map((c) => [c.ref, c.key]))).toEqual(first);
    expect(service.preview(h.project.id, featureAndSteps)).toEqual({
      ok: true,
      keys: { "new:1": "F2", "new:2": "SILO-3", "new:3": "SILO-4" },
    });
  });

  test("an invalid plan writes nothing", async () => {
    const h = setup();
    const service = createPlanService({ data: h.data });
    const plan: PlanAction[] = [
      ...featureAndSteps,
      { id: 4, why, type: "link", from: "new:2", to: "SILO-999", kind: "blocks" },
    ];
    const preview = service.preview(h.project.id, plan);
    expect(preview.ok).toBe(false);
    const outcome = await service.apply(h.project.id, plan);
    expect(outcome.problems.map((p) => [p.actionId, p.type])).toEqual([[4, "link"]]);
    expect(outcome.results).toEqual([]);
    expect(outcome.created).toEqual([]);
    expect(outcome.stoppedAt).toBeNull();
    expect(h.commands).toEqual([]);
  });

  test("the plan stops at the first runtime failure", async () => {
    const h = setup();
    const service = createPlanService({ data: failingAt(h.data, 3) });
    const plan: PlanAction[] = [
      ...featureAndSteps,
      { id: 4, why, type: "link", from: "new:2", to: "new:3", kind: "blocks" },
      { id: 5, why, type: "createQuestion", ticket: "new:2", title: "Quel format de tournée ?" },
    ];
    const outcome = await service.apply(h.project.id, plan);
    expect(outcomes(outcome.results)).toEqual(["applied", "applied", "failed", "skipped", "skipped"]);
    expect(outcome.results[2]?.detail).toBe("boom");
    expect(outcome.results.slice(3).map((r) => r.detail)).toEqual(Array(2).fill("arrêt après l'échec de #3"));
    expect(outcome.stoppedAt).toBe(3);
    expect(outcome.created.map((c) => [c.ref, c.key])).toEqual([
      ["new:1", "F1"],
      ["new:2", "SILO-1"],
    ]);
    expect(h.commands.map((c) => c.method)).toEqual(["createTicket", "createTicket"]);
  });

  test("preview on a server-keyed project gives null keys", () => {
    const h = setup();
    const data: ProjectAgentDataPort = {
      ...h.data,
      forecast: () => ({ nextTicketKey: null, nextFeatureSeq: null, usedShortKeys: [] }),
    };
    expect(createPlanService({ data }).preview(h.project.id, featureAndSteps)).toEqual({
      ok: true,
      keys: { "new:1": null, "new:2": null, "new:3": null },
    });
  });
});
