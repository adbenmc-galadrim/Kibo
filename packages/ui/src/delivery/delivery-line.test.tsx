import { afterEach, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { DeliveryLine } from "./DeliveryLine";

afterEach(cleanup);

const now = 1_000_000_000;
const delivery = {
  step: 7,
  note: "gates verts",
  at: now - 3 * 60_000,
  runId: "r1",
  kind: "delivery" as const,
};

test("the line says the step, its age and its note", () => {
  const { container } = render(<DeliveryLine delivery={delivery} now={now} />);
  expect(container.textContent).toContain("Livraison : 7/11 · Porte qualité · il y a 3 min · gates verts");
});

test("a bar of twelve segments, filled up to the current step", () => {
  render(<DeliveryLine delivery={delivery} now={now} />);
  const bar = screen.getByRole("progressbar");
  expect(bar.getAttribute("aria-valuenow")).toBe("7");
  expect(bar.getAttribute("aria-valuemin")).toBe("0");
  expect(bar.getAttribute("aria-valuemax")).toBe("11");
  const segments = bar.querySelectorAll("[data-segment]");
  expect(segments).toHaveLength(12);
  expect(bar.querySelectorAll("[data-segment='done']")).toHaveLength(8);
});

test("no note, no trailing separator", () => {
  const { container } = render(<DeliveryLine delivery={{ ...delivery, note: "" }} now={now} />);
  expect(container.textContent).toBe("Livraison : 7/11 · Porte qualité · il y a 3 min");
});

test("nothing without a delivery step", () => {
  const { container } = render(<DeliveryLine delivery={null} now={now} />);
  expect(container.innerHTML).toBe("");
});
