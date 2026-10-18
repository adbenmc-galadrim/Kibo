import { expect, test } from "bun:test";
import { startReasonText } from "./start-reason";

test("a short reason for the sprint, the missing sprint and the limit", () => {
  expect(startReasonText({ kind: "sprint", code: "S45" })).toBe("sprint S45");
  expect(startReasonText({ kind: "unplanned" })).toBe("sans sprint");
  expect(startReasonText({ kind: "limit", limit: 2 })).toBe("limite atteinte");
});

test("no extra text when another badge already says it, or nothing is to say", () => {
  expect(startReasonText({ kind: "dependency", keys: ["EMIS-33"] })).toBeNull();
  expect(startReasonText({ kind: "question", label: "Q14" })).toBeNull();
  expect(startReasonText({ kind: "status" })).toBeNull();
  expect(startReasonText(null)).toBeNull();
});
