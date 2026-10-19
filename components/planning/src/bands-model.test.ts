import { expect, test } from "bun:test";
import { createMockSdk } from "@kibo/sdk/mock";
import { bandsTimeline } from "./bands-model";
import { manifest } from "./index";
import { seedPlanningHeld, TODAY } from "./test-seed";

test("bands leave the steps on hold out of the cells and of the risk", () => {
  const m = createMockSdk(manifest, { today: TODAY, seed: seedPlanningHeld });
  const s = m.snapshot();
  const timeline = bandsTimeline({ ...s, today: TODAY, backlog: "À planifier" });
  const f5 = timeline.rows.find((r) => r.shortKey === "F5");
  expect(f5?.cells.map((c) => c.statusId)).toEqual(["done", "in_review"]);
  expect(f5?.tone).toBeUndefined();
  const f7 = timeline.rows.find((r) => r.shortKey === "F7");
  expect(f7?.cells).toHaveLength(4);
});
