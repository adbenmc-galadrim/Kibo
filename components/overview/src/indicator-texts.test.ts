import { expect, test } from "bun:test";
import { indicatorTexts } from "./indicator-texts";
import { build } from "./model-test-kit";

const withOpen = (count: number, level: "under" | "reached" | "over") => {
  const { indicators } = build().model;
  return indicatorTexts({
    ...indicators,
    blockedFeatures: [],
    ahead: [],
    open: { count, limit: 2, level },
  }).open;
};

test("the open tile reads 3 fonctionnalités ouvertes · limite 2 with the amber tone at or over the limit", () => {
  expect(withOpen(3, "over")).toMatchObject({
    value: "3",
    unit: "fonctionnalités ouvertes",
    sub: "limite 2",
    subTone: "amber",
    dot: "amber",
  });
  expect(withOpen(2, "reached").subTone).toBe("amber");
});

test("under the limit the tile stays neutral", () => {
  const open = withOpen(1, "under");
  expect(open).toMatchObject({ unit: "fonctionnalité ouverte", sub: "limite 2" });
  expect(open.subTone).toBeUndefined();
  expect(open.dot).toBeUndefined();
});
