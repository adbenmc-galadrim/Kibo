import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { DeliveryCell, segmentTones } from "./DeliveryCell";

test("twelve segments: the steps passed, the current one in orange, the rest empty; Livré ends in green", () => {
  expect(segmentTones(7)).toEqual([...Array(7).fill("past"), "current", ...Array(4).fill("next")]);
  expect(segmentTones(0)).toEqual(["current", ...Array(11).fill("next")]);
  expect(segmentTones(11)).toEqual([...Array(11).fill("past"), "delivered"]);
});

test("the cell draws the bar and names the step; without delivery it shows a dash", () => {
  const c = render(<DeliveryCell delivery={{ step: 7, note: "", at: 0, runId: null }} />).container;
  expect(c.querySelectorAll("[data-segment]")).toHaveLength(12);
  expect(c.textContent).toBe("7 · Porte qualité");
  expect(render(<DeliveryCell delivery={null} />).container.textContent).toBe("—");
});
