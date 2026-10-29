import { expect, test } from "bun:test";
import type { TicketView } from "@kibo/schema";
import fc from "fast-check";
import { frameHeight } from "./frame-geometry";
import { frameWidth, type SprintLanesModel, sprintLanes } from "./sprint-lanes";
import {
  KIT_DAY_AFTER,
  KIT_HOLDS,
  KIT_LINKS,
  KIT_QUESTIONS,
  KIT_SPRINTS,
  KIT_TODAY,
  kitInput,
  kitTickets,
  kitView,
} from "./sprint-lanes-kit";

const model = (today?: string) =>
  sprintLanes(kitInput(today === undefined ? {} : { tickets: kitTickets(today) }));
const frameOf = (m: SprintLanesModel, shortKey: string) => {
  const f = m.lanes.flatMap((l) => l.frames).find((x) => x.shortKey === shortKey);
  if (f === undefined) throw new Error(`missing ${shortKey}`);
  return f;
};
const frame = (shortKey: string, today?: string) => frameOf(model(today), shortKey);
const held = () => sprintLanes(kitInput({ tickets: kitTickets(KIT_TODAY, KIT_HOLDS) }));

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

test("a three-line title makes its frame 96 high and pushes the next one down", () => {
  const tickets = kitTickets().map((t) =>
    t.title === "Se connecter avec Microsoft"
      ? { ...t, title: "Connexion, environnements et hébergement" }
      : t,
  );
  const s41 = sprintLanes(kitInput({ tickets })).lanes[0]?.frames ?? [];
  expect(s41.map((f) => [f.shortKey, f.titleLines, f.height, f.y])).toEqual([
    ["F1", 3, 96, 70],
    ["F2", 2, 81, 196],
  ]);
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

test("held steps are cyan at their place, a dependency hold is no longer blocked", () => {
  const f5 = frameOf(held(), "F5");
  expect(f5.segments.map((s) => s.tone)).toEqual(["done", "review", "hold", "hold", "hold"]);
  expect(f5.steps.map((s) => s.tone)).toEqual(["done", "review", "hold", "hold", "hold"]);
  expect(f5.steps[2]?.hold).toMatchObject({ source: "own", reason: "Serveur MinIO de recette indisponible" });
  expect(f5.steps[3]?.hold).toMatchObject({ source: "dependency", key: "SILO-33" });
  expect(f5.steps[0]?.hold).toBeNull();
  expect(f5.held).toBe(3);
  expect(f5.collapsed).toBe(false);
});

test("a delivered feature with a held step keeps that step only, its header counts it", () => {
  const f4 = frameOf(held(), "F4");
  expect(f4.delivered).toBe(true);
  expect(f4.steps.map((s) => s.key)).toEqual(["SILO-45"]);
  expect(f4.held).toBe(1);
  expect(f4.segments).toHaveLength(5);
  expect(f4.height).toBe(frameHeight({ lines: f4.titleLines, steps: 1, footer: false }));
  const alone = KIT_SPRINTS.map((s) => (s.code === "S42" ? { ...s, features: ["SILO-40"] } : s));
  const tickets = kitTickets(KIT_TODAY, KIT_HOLDS);
  const f4Alone = frameOf(sprintLanes(kitInput({ tickets, sprints: alone })), "F4");
  expect(f4Alone.width).toBe(frameWidth("Saisir un constat hors ligne", f4.steps));
  expect(f4Alone.width).toBeGreaterThan(126);
  const f1 = frame("F1");
  expect(f1.steps).toEqual([]);
  expect(f1.held).toBe(0);
  expect(f1.width).toBe(126);
});

const startableSteps = (m: SprintLanesModel) =>
  m.lanes.flatMap((l) =>
    l.frames.flatMap((f) => f.steps.filter((s) => s.startable).map((s) => `${f.shortKey} ${s.title}`)),
  );

test("a step is startable when its ticket is startable", () => {
  expect(startableSteps(model())).toEqual(["F6 Contrôle des numéros", "F6 Écran d'import"]);
});

test("a startable step stays off while its feature waits on an undelivered feature", () => {
  const tickets = kitTickets().map((t) => (t.title === "Modèle du rapport" ? { ...t, startable: true } : t));
  expect(startableSteps(sprintLanes(kitInput({ tickets })))).not.toContain("F7 Modèle du rapport");
});

test("a step held back only by its sprint date or the feature limit stays startable", () => {
  const later = (t: TicketView): TicketView =>
    t.title === "Contrôle des numéros"
      ? { ...t, startable: false, startReason: { kind: "sprint", code: "S3" } }
      : t.title === "Écran d'import"
        ? { ...t, startable: false, startReason: { kind: "limit", limit: 2, count: 2 } }
        : t;
  expect(startableSteps(sprintLanes(kitInput({ tickets: kitTickets().map(later) })))).toEqual([
    "F6 Contrôle des numéros",
    "F6 Écran d'import",
  ]);
});

test("a step refused for an open dependency is not startable", () => {
  const blocked = (t: TicketView): TicketView =>
    t.title === "Contrôle des numéros"
      ? {
          ...t,
          startable: false,
          startReason: { kind: "dependency", keys: ["SILO-9"] },
          waitingOn: ["SILO-9"],
        }
      : t;
  expect(startableSteps(sprintLanes(kitInput({ tickets: kitTickets().map(blocked) })))).toEqual([
    "F6 Écran d'import",
  ]);
});

const refused =
  (title: string, over: Partial<TicketView>) =>
  (t: TicketView): TicketView =>
    t.title === title ? { ...t, startable: false, ...over } : t;

test("a last step waiting only on its sibling steps stays startable", () => {
  const last = refused("Contrôle des numéros", { startReason: { kind: "dependency", keys: ["SILO-51"] } });
  expect(startableSteps(sprintLanes(kitInput({ tickets: kitTickets().map(last) })))).toEqual([
    "F6 Contrôle des numéros",
    "F6 Écran d'import",
  ]);
});

test("a step refused only for its feature's blocking question stays startable", () => {
  const asked = refused("Contrôle des numéros", { startReason: { kind: "question", label: "Q2" } });
  expect(startableSteps(sprintLanes(kitInput({ tickets: kitTickets().map(asked) })))).toEqual([
    "F6 Contrôle des numéros",
    "F6 Écran d'import",
  ]);
});

test("a step with its own open blocking question is not startable", () => {
  const tickets = kitTickets().map(
    refused("Contrôle des numéros", { startReason: { kind: "dependency", keys: ["SILO-51"] } }),
  );
  const own = tickets.find((t) => t.title === "Contrôle des numéros")?.id ?? "";
  const [base] = KIT_QUESTIONS;
  if (base === undefined) throw new Error("missing question");
  const questions = [...KIT_QUESTIONS, { ...base, id: "q-own", ticketId: own }];
  expect(startableSteps(sprintLanes(kitInput({ tickets, questions })))).toEqual(["F6 Écran d'import"]);
});

test("a step refused for its status or its hold is not startable", () => {
  const tickets = kitTickets()
    .map(refused("Contrôle des numéros", { startReason: { kind: "status" } }))
    .map(
      refused("Écran d'import", {
        startReason: {
          kind: "onHold",
          hold: { source: "own", key: "SILO-53", reason: "Retour du client", since: "2026-10-16" },
        },
      }),
    );
  expect(startableSteps(sprintLanes(kitInput({ tickets })))).toEqual([]);
});

test("a step stays startable when only a sibling step waits on another feature", () => {
  const links = [...KIT_LINKS, { id: "sibling", from: "SILO-41", to: "SILO-54", type: "blocks" as const }];
  expect(startableSteps(sprintLanes(kitInput({ links })))).toEqual([
    "F6 Contrôle des numéros",
    "F6 Écran d'import",
  ]);
});

test("every step goes off when its feature itself waits on an undelivered feature", () => {
  const links = [...KIT_LINKS, { id: "root", from: "SILO-40", to: "SILO-50", type: "blocks" as const }];
  expect(startableSteps(sprintLanes(kitInput({ links })))).toEqual([]);
});
