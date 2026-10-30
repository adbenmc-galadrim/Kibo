import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  ATTENTE_ORIGINS,
  ATTENTE_SCREENS,
  DIALOG_SCREENS,
  MASK_AREA_LIMIT,
  type MaskedScreen,
  maskedRatio,
  masksOf,
  outside,
  PIXEL_HEIGHTS,
  PIXEL_MASKS,
  referenceOf,
} from "./pixel-masks";

const WIDTH = 1440;
const screens = Object.keys(PIXEL_MASKS).filter((s): s is MaskedScreen => Object.hasOwn(PIXEL_HEIGHTS, s));

test("every mask stays inside its screen and says why", () => {
  expect(screens).toEqual([
    "planning",
    "fonctionnalite",
    "vue-ensemble",
    "graphe",
    "graphe-prs",
    "apercu-maquette",
    "nouveau-projet",
    "kanban",
    "fiche-ticket",
    "questions",
    "attente-vue-ensemble",
    "attente-planning",
    "attente-fonctionnalite",
    "attente-kanban",
    "attente-fiche-ticket",
    "attente-graphe",
    "agent-agrandi",
  ]);
  for (const screen of screens)
    for (const m of PIXEL_MASKS[screen]) {
      expect(outside(m, WIDTH, PIXEL_HEIGHTS[screen])).toBe(false);
      expect(m.why.length).toBeGreaterThan(10);
    }
});

test("each screen masks at most 4 % of its pixels", () => {
  expect(MASK_AREA_LIMIT).toBe(0.04);
  for (const screen of screens)
    expect(maskedRatio(PIXEL_MASKS[screen], WIDTH, PIXEL_HEIGHTS[screen])).toBeLessThanOrEqual(
      MASK_AREA_LIMIT,
    );
});

test("no mask hides what phase 26 now draws", () => {
  const phase26 = /session|\bCI\b|changements demandés|journal|agent|Vue d'ensemble|décal/i;
  for (const screen of screens) for (const m of PIXEL_MASKS[screen]) expect(m.why).not.toMatch(phase26);
});

test("the sidebar is compared in place, without the shifted pages", () => {
  expect(existsSync(new URL("./pixel-sidebar.ts", import.meta.url))).toBe(false);
  for (const screen of screens)
    expect(PIXEL_MASKS[screen].filter((m) => m.x === 10 && m.w === 220)).toEqual([]);
});

test("the union of masks counts overlapping pixels once", () => {
  const box = { x: 0, y: 0, w: 10, h: 10 };
  expect(maskedRatio([box, box, { ...box, x: 5 }], 100, 10)).toBeCloseTo(0.15, 6);
  expect(outside({ x: 1435, y: 0, w: 10, h: 10 }, WIDTH, 1000)).toBe(true);
});

test("a screen without masks gets none", () => {
  expect(masksOf("kit")).toEqual([]);
  expect(masksOf("planning")).toBe(PIXEL_MASKS.planning);
});

test("the phase 27 screens are 1000 px high and the Vue d'ensemble compares against v3", () => {
  for (const screen of ["nouveau-projet", "kanban", "fiche-ticket", "questions"] as const)
    expect(PIXEL_HEIGHTS[screen]).toBe(1000);
  expect(referenceOf("vue-ensemble")).toBe("vue-ensemble-v3");
  expect(referenceOf("kanban")).toBe("kanban");
});

test("no mask covers a dialog, a popover or the ticket sheet", () => {
  for (const [screen, box] of Object.entries(DIALOG_SCREENS))
    for (const m of masksOf(screen)) {
      const apart = m.x + m.w <= box.x || box.x + box.w <= m.x || m.y + m.h <= box.y || box.y + box.h <= m.y;
      expect(apart).toBe(true);
    }
});

const MOVED: readonly string[] = ["attente-vue-ensemble", "attente-fonctionnalite"];
const whys = (screen: string) => new Set(masksOf(screen).map((m) => m.why));

test("each on-hold screen keeps the height, the masks and the dialog of the screen it comes from", () => {
  expect(ATTENTE_ORIGINS).toEqual({
    "attente-vue-ensemble": "vue-ensemble",
    "attente-planning": "planning",
    "attente-fonctionnalite": "fonctionnalite",
    "attente-kanban": "kanban",
    "attente-fiche-ticket": "fiche-ticket",
    "attente-graphe": "graphe",
  });
  for (const screen of ATTENTE_SCREENS) {
    const origin = ATTENTE_ORIGINS[screen];
    expect(PIXEL_HEIGHTS[screen]).toBe(PIXEL_HEIGHTS[origin]);
    if (MOVED.includes(screen)) expect([...whys(screen)].every((why) => whys(origin).has(why))).toBe(true);
    else expect(masksOf(screen)).toEqual(PIXEL_MASKS[origin]);
    expect(DIALOG_SCREENS[screen]).toEqual(DIALOG_SCREENS[origin]);
    expect(referenceOf(screen)).toBe(screen);
  }
});

test("the on-hold Vue d'ensemble masks the hours of its four activity rows and of its questions where they moved", () => {
  const at = (what: string) =>
    masksOf("attente-vue-ensemble")
      .filter((m) => m.why.includes(what))
      .map((m) => [m.x, m.y]);
  expect(at("de l'activité")).toEqual([
    [279, 1072],
    [279, 1111],
    [279, 1150],
    [279, 1189],
  ]);
  expect(at("de Q14")).toEqual([[906, 1088]]);
  expect(at("de Q16")).toEqual([[912, 1151]]);
  expect(at("de Q17")).toEqual([[903, 1212]]);
});

test("the on-hold sheet of F5 drops the masks of SILO-33's running step and lifts the side column by 21 px", () => {
  const ys = masksOf("attente-fonctionnalite")
    .filter((m) => m.x > 1000)
    .map((m) => m.y);
  expect(ys).toEqual([392, 477, 507, 537]);
  expect(
    masksOf("attente-fonctionnalite").some((m) => m.why.includes("SILO-33") || m.why.includes("branche")),
  ).toBe(false);
});

test("the Graphe compares against P5b and its PRs view against P5c, masking only the user", () => {
  expect(referenceOf("graphe")).toBe("graphe-fonctionnalites");
  expect(referenceOf("graphe-prs")).toBe("graphe-prs");
  expect(PIXEL_HEIGHTS["graphe-prs"]).toBe(1000);
  expect(masksOf("graphe-prs")).toEqual(masksOf("graphe").slice(0, 1));
  expect(masksOf("graphe-prs").map((m) => m.why)).toEqual([expect.stringContaining("utilisateur")]);
});

test("the full-screen mockup compares against P8g on 1000 px, without a single mask", () => {
  expect(referenceOf("apercu-maquette")).toBe("apercu-maquette");
  expect(PIXEL_HEIGHTS["apercu-maquette"]).toBe(1000);
  expect(PIXEL_MASKS["apercu-maquette"]).toEqual([]);
});

test("the Graphe on hold compares against its own board on 1000 px, with the masks of the Graphe", () => {
  expect(PIXEL_HEIGHTS["attente-graphe"]).toBe(1000);
  expect(masksOf("attente-graphe")).toEqual(PIXEL_MASKS.graphe);
  expect(referenceOf("attente-graphe")).toBe("attente-graphe");
});

test("the widened agent covers the Vue d'ensemble from x 720 and keeps only the masks left of it", () => {
  expect(PIXEL_HEIGHTS["agent-agrandi"]).toBe(PIXEL_HEIGHTS["vue-ensemble"]);
  expect(referenceOf("agent-agrandi")).toBe("agent-agrandi");
  expect(DIALOG_SCREENS["agent-agrandi"]).toEqual({ x: 720, y: 0, w: 720, h: 1400 });
  const kept = masksOf("agent-agrandi");
  expect(kept.map((m) => [m.x, m.y])).toEqual([
    [16, 1216],
    [279, 1074],
    [279, 1113],
    [279, 1152],
    [279, 1191],
  ]);
  for (const m of kept) expect(masksOf("vue-ensemble")).toContainEqual(m);
});

test("no Vue d'ensemble mask hides the header of the narrow panel", () => {
  for (const screen of ["vue-ensemble", "attente-vue-ensemble"])
    expect(masksOf(screen).filter((m) => m.x + m.w > 1100 && m.y < 56)).toEqual([]);
});
