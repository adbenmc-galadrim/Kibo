import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { KiboLogo } from "./KiboLogo";
import { KIBO_MARK } from "./kibo-mark";

test("the logo draws the tile and the five cards of the mark", () => {
  render(<KiboLogo className="size-14" />);
  const svg = screen.getByRole("img", { name: "Kibo" });
  expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
  const rects = Array.from(svg.querySelectorAll("rect"));
  expect(rects).toHaveLength(1 + KIBO_MARK.cards.length);
  expect(rects[0]?.getAttribute("class")).toContain("fill-card");
  expect(rects.filter((r) => r.getAttribute("fill") === "#F97316")).toHaveLength(1);
  expect(rects.filter((r) => r.getAttribute("fill") === "currentColor")).toHaveLength(4);
});

test("a decorative logo is hidden from assistive tech", () => {
  render(<KiboLogo decorative />);
  expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
});
