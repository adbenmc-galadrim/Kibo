import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { FeatureFrame } from "./FeatureFrame";
import type { LaneFrame } from "./sprint-lanes";

afterEach(cleanup);

const frame = (over: Partial<LaneFrame> = {}): LaneFrame => ({
  id: "f",
  shortKey: "F5",
  title: "Envoyer les photos",
  done: 1,
  total: 2,
  delivered: false,
  held: 0,
  late: false,
  collapsed: false,
  folded: false,
  segments: [],
  steps: [],
  footer: null,
  titleLines: 1,
  x: 0,
  y: 0,
  width: 200,
  height: 66,
  ...over,
});

const renderFrame = (over?: Partial<LaneFrame>) => {
  render(<FeatureFrame frame={frame(over)} onOpen={() => undefined} />);
  return screen.getByRole("article");
};

test("the frame has a solid 1 px border, no dash array", () => {
  const article = renderFrame();
  expect(article.querySelector("[stroke-dasharray]")).toBeNull();
  expect(article.className).toContain("border ");
  expect(article.className).toContain("border-(--tracking-border)");
});

test("late stays red", () => {
  const article = renderFrame({ late: true });
  expect(article.className).toContain("border-(--tracking-red)");
  expect(article.className).not.toContain("border-(--tracking-border)");
});

test("held stays cyan on its mark, the border stays neutral", () => {
  const article = renderFrame({ held: 3 });
  expect(screen.getByRole("img", { name: "3 en attente" }).className).toContain("text-(--tracking-hold)");
  expect(article.className).toContain("border-(--tracking-border)");
});
