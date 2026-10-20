import { expect, test } from "bun:test";
import fc from "fast-check";
import { frameWidth, sprintLanes } from "./sprint-lanes";
import { KIT_DAY_AFTER, KIT_LINKS, kitInput, kitTickets, kitView } from "./sprint-lanes-kit";

const model = (today?: string) =>
  sprintLanes(kitInput(today === undefined ? {} : { tickets: kitTickets(today) }));
const frame = (shortKey: string, today?: string) => {
  const f = model(today)
    .lanes.flatMap((l) => l.frames)
    .find((x) => x.shortKey === shortKey);
  if (f === undefined) throw new Error(`missing ${shortKey}`);
  return f;
};

test("one column per sorted sprint, then « À planifier »", () => {
  const lanes = model().lanes;
  expect(lanes.map((l) => l.code)).toEqual(["S41", "S42", "S43", "S44", null]);
  expect(lanes.map((l) => l.frames.map((f) => f.shortKey))).toEqual([
    ["F1", "F2"],
    ["F3", "F4", "F5"],
    ["F6", "F8"],
    ["F7"],
    ["F9"],
  ]);
  expect(lanes.map((l) => l.state)).toEqual(["done", "current", "planned", "planned", null]);
  expect(lanes.map((l) => l.tone)).toEqual(["canvas", "panel", "canvas", "panel", "canvas"]);
});

test("delivered features are always collapsed, the others list their steps", () => {
  for (const key of ["F1", "F2", "F3"]) {
    expect(frame(key).collapsed).toBe(true);
    expect(frame(key).delivered).toBe(true);
  }
  for (const key of ["F4", "F5", "F6", "F7", "F8", "F9"]) expect(frame(key).collapsed).toBe(false);
  expect(frame("F4").steps.map((s) => s.title)).toEqual([
    "Schéma local des constats",
    "Formulaire de saisie",
    "Synchro au retour du réseau",
    "Conflits de saisie",
    "Démo client",
  ]);
  expect([frame("F4").done, frame("F4").total]).toEqual([3, 5]);
  for (const f of model().lanes.flatMap((l) => l.frames)) expect(f.collapsed).toBe(f.delivered);
  expect(frame("F1").steps).toHaveLength(0);
});

test("late and blocked features carry their footer", () => {
  expect(frame("F5").late).toBe(false);
  expect(frame("F5").footer).toBeNull();
  expect(frame("F5", KIT_DAY_AFTER).late).toBe(true);
  expect(frame("F5", KIT_DAY_AFTER).footer).toEqual({ kind: "late", slipTo: "S43" });
  expect(frame("F6").late).toBe(false);
  expect(frame("F6").footer).toEqual({ kind: "blocked", question: "Q14" });
  expect(frame("F4").footer).toBeNull();
});

test("a merged PR with changes requested is marked merged, not amber", () => {
  const tickets = kitTickets().map((t) => ({
    ...t,
    externalRefs: t.externalRefs.map((r) =>
      r.kind === "github_pr" && r.review === "changes_requested" ? { ...r, state: "merged" as const } : r,
    ),
  }));
  const f4 = sprintLanes(kitInput({ tickets }))
    .lanes.flatMap((l) => l.frames)
    .find((f) => f.shortKey === "F4");
  expect(f4?.steps[3]?.git).toEqual({ kind: "merged", tone: "green" });
});

test("steps carry their tone, their git mark and the session", () => {
  const f4 = frame("F4").steps;
  expect(f4.map((s) => s.tone)).toEqual(["done", "done", "done", "review", "todo"]);
  expect(f4[0]?.git).toEqual({ kind: "merged", tone: "green" });
  expect(f4[3]?.git).toEqual({ kind: "pr", tone: "amber" });
  expect(f4[3]?.session).toBe(true);
  expect(f4[4]?.git).toBeNull();
  const f5 = frame("F5").steps;
  expect(f5[1]?.git).toEqual({ kind: "pr", tone: "purple" });
  expect(f5[2]).toMatchObject({ tone: "progress", git: { kind: "branch", tone: "blue" }, session: true });
  expect(frame("F6").steps[0]?.tone).toBe("blocked");
  const live = sprintLanes(kitInput({ live: new Set(["SILO-34"]) }));
  const tests = live.lanes[1]?.frames[2]?.steps[3];
  expect(tests?.session).toBe(true);
});

test("frame width follows the content within 126 to 262, the column adds its margins", () => {
  const lanes = model().lanes;
  expect(lanes[0]?.frames.map((f) => f.width)).toEqual([126, 126]);
  expect(lanes[0]?.width).toBe(150);
  for (const lane of lanes.slice(1)) {
    const width = lane.frames[0]?.width ?? 0;
    expect(width).toBeGreaterThanOrEqual(126);
    expect(width).toBeLessThanOrEqual(262);
    expect(lane.frames.every((f) => f.width === width)).toBe(true);
    expect(lane.width).toBe(width + 28);
  }
  expect(lanes[1]?.frames[0]?.width).toBe(262);
  expect(lanes.map((l) => l.x)).toEqual(
    lanes.map((_, i) => lanes.slice(0, i).reduce((sum, l) => sum + l.width, 0)),
  );
});

test("frames stack by rank with 30 px between them", () => {
  const s42 = model().lanes[1]?.frames ?? [];
  expect(s42.map((f) => f.height)).toEqual([66, 216, 216]);
  expect(s42.map((f) => f.y)).toEqual([70, 166, 412]);
  expect(frame("F1").height).toBe(81);
  expect(frame("F1").titleLines).toBe(2);
  expect(frame("F6").height).toBe(206);
  expect(frame("F4").x).toBe((model().lanes[1]?.x ?? 0) + 14);
  expect(frame("F1").x).toBe(12);
});

test("edges link feature roots only, step links are counted", () => {
  const m = model();
  expect(m.features).toBe(9);
  expect(m.stepLinks).toBe(2);
  expect(m.featureLinks).toBe(8);
  const short = new Map(m.lanes.flatMap((l) => l.frames).map((f) => [f.id, f.shortKey]));
  expect(m.edges.map((e) => `${short.get(e.from)}>${short.get(e.to)}`).sort()).toEqual(
    ["F2>F3", "F2>F4", "F3>F5", "F2>F6", "F4>F8", "F4>F7", "F5>F7", "F7>F9"].sort(),
  );
});

test("a link between steps of two features is lifted to their roots", () => {
  const extra = { id: "lx", from: "SILO-54", to: "SILO-71", type: "blocks" as const };
  const m = sprintLanes(kitInput({ links: [...KIT_LINKS, extra] }));
  expect(m.featureLinks).toBe(9);
  expect(m.stepLinks).toBe(3);
  expect(m.edges.some((e) => e.from === "SILO-50" && e.to === "SILO-70")).toBe(true);
});

test("without any sprint every feature sits in a single « À planifier » column", () => {
  const m = sprintLanes(kitInput({ sprints: [] }));
  expect(m.lanes.map((l) => [l.id, l.code, l.tone])).toEqual([["reserve", null, "canvas"]]);
  expect(m.lanes[0]?.frames.map((f) => f.shortKey)).toEqual([
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
  ]);
  expect(m.features).toBe(9);
});

test("loose tickets are not frames", () => {
  const ids = model().lanes.flatMap((l) => l.frames.map((f) => f.id));
  expect(ids).not.toContain("SILO-61");
  expect(kitTickets().some((t) => t.id === "SILO-61")).toBe(true);
});

test("frame width grows with the longest title and stays bounded", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 120 }), fc.string({ maxLength: 120 }), (a, b) => {
      const short = a.length <= b.length ? a : b;
      const long = a.length <= b.length ? b : a;
      const w = (title: string) => frameWidth(kitView({ id: "x", title }).title, []);
      expect(w(short)).toBeGreaterThanOrEqual(126);
      expect(w(long)).toBeLessThanOrEqual(262);
      expect(w(`${short}${short}`)).toBeGreaterThanOrEqual(w(short));
    }),
  );
});

test("each sprint column says its state with the overview's words", () => {
  const at = (today: string) =>
    sprintLanes(kitInput({ tickets: kitTickets(today), today })).lanes.map((l) => l.label);
  expect(at("2026-10-14")).toEqual(["terminé le 9 oct.", "en cours", "prévu", "prévu", null]);
  expect(at("2026-10-16")).toEqual(["terminé le 9 oct.", "se termine aujourd'hui", "prévu", "prévu", null]);
  expect(at(KIT_DAY_AFTER)?.[1]).toBe("terminé le 16 oct. · reste 2");
});
