import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { DeliveryStepChip } from "./delivery-step-chip";

afterEach(cleanup);

const delivery = { step: 7, note: "gates verts", at: 1, runId: null, kind: "delivery" as const };

test("the chip shows the delivery step in zinc", () => {
  const { container } = render(<DeliveryStepChip ticket={{ statusId: "in_progress", delivery }} />);
  const chip = container.querySelector("[data-delivery-step]");
  expect(chip?.textContent).toBe("7 · Porte qualité");
  expect(chip?.className).toContain("zinc");
  expect(chip?.className).not.toContain("brand");
});

test("no chip without a delivery step or on a done ticket", () => {
  const none = render(<DeliveryStepChip ticket={{ statusId: "in_progress", delivery: null }} />);
  expect(none.container.innerHTML).toBe("");
  cleanup();
  const done = render(<DeliveryStepChip ticket={{ statusId: "done", delivery }} />);
  expect(done.container.innerHTML).toBe("");
});
