import { expect, test } from "bun:test";
import { type FeatureView, lateFeatures } from "./late-features";

const SPRINTS = [
  { id: "s41", code: "S41", name: "Accès", start: "2026-10-05", end: "2026-10-09" },
  { id: "s42", code: "S42", name: "Saisie", start: "2026-10-12", end: "2026-10-16" },
  { id: "s43", code: "S43", name: "Import", start: "2026-10-19", end: "2026-10-23" },
  { id: "s44", code: "S44", name: "Rapports", start: "2026-10-26", end: "2026-10-30" },
];

const feature = (id: string, sprintId: string | null, remaining: number, rank: number): FeatureView => ({
  id,
  sprintId,
  remaining,
  rank,
});

const FEATURES = [
  feature("F1", "s41", 0, 1),
  feature("F2", "s41", 0, 2),
  feature("F3", "s42", 0, 3),
  feature("F4", "s42", 0, 4),
  feature("F5", "s42", 2, 5),
  feature("F6", "s43", 3, 6),
  feature("F7", "s43", 1, 7),
  feature("F8", "s44", 4, 8),
  feature("F9", null, 2, 9),
];

const ids = (today: string) => lateFeatures(FEATURES, SPRINTS, today).map((f) => f.id);

test("a feature is late once its sprint is over with mandatory steps left", () => {
  expect(ids("2026-10-16")).toEqual([]);
  expect(ids("2026-10-17")).toEqual(["F5"]);
  expect(ids("2026-10-24")).toEqual(["F5", "F6", "F7"]);
});

test("delivered features, unplanned ones and unknown sprints are never late", () => {
  expect(ids("2026-12-01")).toEqual(["F5", "F6", "F7", "F8"]);
  expect(lateFeatures([feature("FX", "gone", 3, 1)], SPRINTS, "2026-12-01")).toEqual([]);
});

test("late features sort by sprint end, then by rank", () => {
  const shuffled = [feature("F7", "s43", 1, 7), feature("F5", "s42", 2, 5), feature("F6", "s43", 3, 6)];
  expect(lateFeatures(shuffled, SPRINTS, "2026-10-24").map((f) => f.id)).toEqual(["F5", "F6", "F7"]);
});
