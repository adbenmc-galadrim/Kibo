import { expect, test } from "bun:test";
import { emisSnapshot } from "./overview-test-kit";
import { sprintSummaries } from "./sprint-summary";

test("each sprint lists its features with their state and what remains", () => {
  const summaries = sprintSummaries(emisSnapshot());
  expect(summaries.map((s) => [s.code, s.state])).toEqual([
    ["S41", "done"],
    ["S42", "current"],
    ["S43", "planned"],
    ["S44", "planned"],
  ]);
  expect(summaries[1]).toMatchObject({
    id: "s42",
    name: "Terrain hors ligne",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  expect(summaries[1]?.features).toEqual([
    { shortKey: "F3", title: "Réaffecter un ISO", state: "delivered", remaining: 0 },
    { shortKey: "F4", title: "Saisir un tronçon hors ligne", state: "open", remaining: 1 },
    { shortKey: "F5", title: "Envoyer les photos d'un tronçon", state: "late", remaining: 4 },
  ]);
  expect(summaries[2]?.features.map((f) => [f.shortKey, f.state])).toEqual([
    ["F6", "blocked"],
    ["F8", "todo"],
  ]);
});
