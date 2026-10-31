import { describe, expect, test } from "bun:test";
import {
  PLAN_ACTION_TYPES,
  PLAN_ACTIONS_MAX,
  PlanAction,
  PlanActions,
  PlanOutcome,
  PlanPreview,
} from "./plan";

const why = "";
const SAMPLES: Record<string, Record<string, unknown>> = {
  createTicket: { ref: "new:1", title: "Tournée et dépôt", feature: true },
  updateTicket: { ticket: "SILO-12", title: "Relevés" },
  setStatus: { ticket: "SILO-12", statusId: "todo" },
  setHold: { ticket: "SILO-12", reason: null },
  link: { from: "SILO-12", to: "new:1", kind: "blocks" },
  unlink: { from: "SILO-12", to: "SILO-13", kind: "blocks" },
  createSprint: { code: "S43", name: "Sprint 43", start: "2026-11-02", end: "2026-11-06" },
  setSprint: { ticket: "F5", sprint: "S43" },
  createQuestion: { ticket: "SILO-12", title: "Quel format ?", options: ["PDF", "CSV"] },
  answerQuestion: { questionId: "q1", answer: { kind: "option", option: "PDF" } },
  updateQuestion: { questionId: "q1", title: "Quel format d'export ?" },
  reopenQuestion: { questionId: "q1" },
  deleteQuestion: { questionId: "q1" },
  addRecipient: { name: "Claire" },
};
const action = (type: string, fields: Record<string, unknown> = SAMPLES[type] ?? {}) => ({
  id: 1,
  why,
  type,
  ...fields,
});

describe("plan actions", () => {
  test("every plan action type parses", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...PLAN_ACTION_TYPES].sort());
    for (const type of PLAN_ACTION_TYPES) expect(PlanAction.safeParse(action(type)).success).toBe(true);
  });

  test("agents, notes, signals and reminders are refused", () => {
    expect(
      PlanAction.safeParse(action("assignAgent", { ticket: "SILO-12", profileId: "livraison" })).success,
    ).toBe(false);
    expect(PlanAction.safeParse(action("dismissSignal", { signal: "sig:1" })).success).toBe(false);
    const refused = [
      action("createNote", { path: "notes/a.md", content: "" }),
      action("remindQuestion", { questionId: "q1" }),
    ];
    for (const a of refused) {
      const parsed = PlanAction.safeParse(a);
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues[0]).toMatchObject({
        path: ["type"],
        message: `${a.type} is not allowed in a plan`,
      });
    }
  });

  test("a plan holds between 1 and 500 actions", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...action("reopenQuestion"), id: i + 1 }));
    expect(PlanActions.safeParse([]).success).toBe(false);
    expect(PlanActions.safeParse(many(PLAN_ACTIONS_MAX)).success).toBe(true);
    expect(PlanActions.safeParse(many(PLAN_ACTIONS_MAX + 1)).success).toBe(false);
  });

  test("createTicket takes an optional feature flag", () => {
    expect(PlanAction.parse(action("createTicket"))).toMatchObject({ feature: true });
    expect(PlanAction.safeParse(action("createTicket", { ref: "new:2", title: "Étape" })).success).toBe(true);
    expect(
      PlanAction.safeParse(action("createTicket", { ref: "new:2", title: "x", feature: "yes" })).success,
    ).toBe(false);
  });
});

describe("plan results", () => {
  test("a preview is either predicted keys or problems", () => {
    expect(PlanPreview.parse({ ok: true, keys: { "new:1": "F43", "new:2": null } })).toEqual({
      ok: true,
      keys: { "new:1": "F43", "new:2": null },
    });
    expect(
      PlanPreview.safeParse({
        ok: false,
        problems: [{ actionId: 1, type: "link", message: "lien déjà présent" }],
      }).success,
    ).toBe(true);
  });

  test("an outcome lists results, created tickets and where it stopped", () => {
    const outcome = PlanOutcome.parse({
      problems: [],
      results: [{ actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t1", key: "F43" } }],
      created: [{ ref: "new:1", ticketId: "t1", key: "F43" }],
      stoppedAt: null,
    });
    expect(outcome.created).toEqual([{ ref: "new:1", ticketId: "t1", key: "F43" }]);
  });
});
