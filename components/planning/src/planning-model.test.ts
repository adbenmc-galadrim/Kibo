import { expect, test } from "bun:test";
import type { SprintView } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { manifest } from "./index";
import { type FeatureCard, planningModel, sprintDates } from "./planning-model";
import { seedPlanning, TODAY } from "./test-seed";

const SPRINT: SprintView = {
  id: "s",
  code: "S42",
  name: "X9 Terrain",
  start: TODAY,
  end: TODAY,
  state: "current",
  features: [],
  delivered: 0,
  total: 0,
};
const columnCode = (sprint: SprintView) =>
  planningModel({ tickets: [], links: [], sprints: [sprint], questions: [] }).sprints[0]?.code;

const build = (today = TODAY, openLimit?: number) => {
  let seeded: ReturnType<typeof seedPlanning> | undefined;
  const m = createMockSdk(manifest, {
    today,
    seed: (run) => {
      seeded = seedPlanning(run);
    },
  });
  const s = m.snapshot();
  if (!seeded) throw new Error("seed missing");
  const model = planningModel({
    tickets: s.tickets,
    links: s.links,
    sprints: s.sprints,
    questions: s.questions,
    openLimit,
  });
  return { model, seeded, m };
};

const card = (cards: readonly FeatureCard[], shortKey: string): FeatureCard => {
  const found = cards.find((c) => c.shortKey === shortKey);
  if (!found) throw new Error(`${shortKey} missing`);
  return found;
};

test("columns are the sprints by start date, then the backlog of features without sprint", () => {
  const { model } = build();
  expect(model.sprints.map((c) => c.code)).toEqual(["S41", "S42", "S43", "S44"]);
  expect(model.sprints.map((c) => c.cards.map((x) => x.shortKey))).toEqual([
    ["F1", "F2"],
    ["F3", "F4", "F5"],
    ["F6", "F8"],
    ["F7"],
  ]);
  expect(model.backlog.map((x) => x.shortKey)).toEqual(["F9"]);
});

test("a root ticket without steps is not a card", () => {
  const { model } = build();
  const titles = [...model.sprints.flatMap((c) => c.cards), ...model.backlog].map((c) => c.title);
  expect(titles).not.toContain("Corriger l'export PDF");
});

test("the header counts delivered features, all features and the unplanned ones", () => {
  const { model } = build();
  expect({ delivered: model.delivered, total: model.total, unplanned: model.unplanned }).toEqual({
    delivered: 3,
    total: 9,
    unplanned: 1,
  });
});

test("sprint columns carry their code, dates, state and delivered count", () => {
  const { model } = build();
  const [s41, s42, s43] = model.sprints;
  expect(s41?.dates).toBe("5–9 oct.");
  expect(s41?.sprint.state).toBe("done");
  expect([s41?.sprint.delivered, s41?.sprint.total]).toEqual([2, 2]);
  expect(s42?.sprint.state).toBe("current");
  expect([s42?.sprint.delivered, s42?.sprint.total]).toEqual([1, 3]);
  expect(s43?.sprint.state).toBe("planned");
});

test("a step case per step, toned by its status or its blocking question", () => {
  const { model } = build();
  const [, s42, s43] = model.sprints;
  expect(card(s42?.cards ?? [], "F4").steps.map((s) => s.tone)).toEqual([
    "done",
    "done",
    "done",
    "review",
    "todo",
  ]);
  expect(card(s42?.cards ?? [], "F5").steps.map((s) => s.tone)).toEqual([
    "done",
    "review",
    "progress",
    "todo",
    "todo",
  ]);
  expect(card(s43?.cards ?? [], "F6").steps.map((s) => s.tone)).toEqual(["blocked", "todo", "todo", "todo"]);
});

test("badges: delivered, open, late, blocked with the question, nothing when not started", () => {
  const { model } = build();
  const [s41, s42, s43] = model.sprints;
  expect(card(s41?.cards ?? [], "F1").badge).toEqual({ kind: "delivered", demo: false });
  expect(card(s43?.cards ?? [], "F6").badge).toEqual({ kind: "blocked", question: "Q14" });
  expect(card(s43?.cards ?? [], "F8").badge).toBeNull();
  expect(card(s42?.cards ?? [], "F4").badge).toEqual({ kind: "open" });
  expect(card(s42?.cards ?? [], "F5").badge).toEqual({ kind: "late" });
});

test("the card reads the feature state as is, the interface computes no state", () => {
  const { model, m } = build();
  const f5 = m.snapshot().tickets.find((t) => t.shortKey === "F5");
  expect(card(model.sprints[1]?.cards ?? [], "F5").late).toBe(f5?.feature?.status === "late");
});

test("a delivered feature in a finished sprint is folded, its title muted", () => {
  const { model } = build();
  const [s41, s42] = model.sprints;
  expect(card(s41?.cards ?? [], "F1")).toMatchObject({ compact: true, muted: true });
  expect(card(s42?.cards ?? [], "F3")).toMatchObject({ compact: false, muted: true });
  expect(card(s42?.cards ?? [], "F4")).toMatchObject({ compact: false, muted: false });
});

test("the footer shows the step in session, else the next step", () => {
  const { model } = build();
  const [, s42, s43] = model.sprints;
  const f4 = card(s42?.cards ?? [], "F4");
  const f5 = card(s42?.cards ?? [], "F5");
  const f6 = card(s43?.cards ?? [], "F6");
  expect([f4.done, f4.total, f4.session]).toEqual([3, 5, "KIB-16"]);
  expect([f5.done, f5.total, f5.session]).toEqual([1, 5, "KIB-21"]);
  expect([f6.session, f6.next]).toEqual([null, "KIB-25"]);
  expect(card(s42?.cards ?? [], "F3").next).toBeNull();
});

test("a late feature gets a warning under its sprint", () => {
  const { model } = build();
  expect(card(model.sprints[1]?.cards ?? [], "F5")).toMatchObject({ badge: { kind: "late" }, late: true });
  expect(model.sprints[1]?.warnings).toEqual([{ shortKey: "F5", remaining: 4 }]);
  expect(build("2026-10-14").model.sprints[1]?.warnings).toEqual([]);
});

test("open features count only planned ones, the limit is a warning", () => {
  const { model } = build();
  expect([model.open, model.limit, model.overLimit]).toEqual([2, 2, false]);
  const over = build(TODAY, 1).model;
  expect([over.open, over.limit, over.overLimit]).toEqual([2, 1, true]);
});

test("the column shows the sprint code, never derived from its name", () => {
  const { model } = build();
  expect(model.sprints[1]?.sprint.name).toBe("Terrain hors ligne");
  expect(columnCode(SPRINT)).toBe("S42");
});

test("sprint dates are short and French", () => {
  expect(sprintDates("2026-10-12", "2026-10-16")).toBe("12–16 oct.");
  expect(sprintDates("2026-09-28", "2026-10-02")).toBe("28 sept.–2 oct.");
  expect(sprintDates("2026-12-28", "2027-01-01")).toBe("28 déc.–1 janv.");
});
