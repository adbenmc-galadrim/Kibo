import { expect, test } from "bun:test";
import type { DeliveryStep } from "@kibo/schema";
import { render } from "@testing-library/react";
import { DeliveryCell, segmentTones } from "./DeliveryCell";

const step = (n: number, kind: DeliveryStep["kind"] = "delivery"): DeliveryStep => ({
  step: n,
  note: "",
  at: 0,
  runId: null,
  kind,
});

test("twelve segments: the steps passed, the current one in orange, the rest empty; Livré ends in green", () => {
  expect(segmentTones(7)).toEqual([...Array(7).fill("past"), "current", ...Array(4).fill("next")]);
  expect(segmentTones(0)).toEqual(["current", ...Array(11).fill("next")]);
  expect(segmentTones(11)).toEqual([...Array(11).fill("past"), "delivered"]);
});

test("the cell draws the bar and names the step; without delivery it shows a dash", () => {
  const c = render(<DeliveryCell delivery={step(7)} />).container;
  expect(c.querySelectorAll("[data-segment]")).toHaveLength(12);
  expect(c.textContent).toBe("7 · Porte qualité");
  expect(render(<DeliveryCell delivery={null} />).container.textContent).toBe("—");
});

test("a touch-up step reads retouche before the step", () => {
  const c = render(<DeliveryCell delivery={step(7, "update")} />).container;
  expect(c.querySelectorAll("[data-segment]")).toHaveLength(12);
  expect(c.textContent).toBe("retouche · 7 · Porte qualité");
});
