import { expect, test } from "bun:test";
import { startReasonText } from "./start-reason";

test("a short reason for the sprint, the missing sprint and the limit", () => {
  expect(startReasonText({ kind: "sprint", code: "S45" })).toBe("sprint S45");
  expect(startReasonText({ kind: "unplanned" })).toBe("sans sprint");
  expect(startReasonText({ kind: "limit", limit: 2, count: 2 })).toBe("limite 2/2");
});

test("the last step waits for the steps that no « attend » badge names yet", () => {
  expect(startReasonText({ kind: "dependency", keys: ["PFD-3"] })).toBe("attend PFD-3");
  expect(startReasonText({ kind: "dependency", keys: ["PFD-2", "PFD-3"] }, ["PFD-2"])).toBe("attend PFD-3");
  expect(startReasonText({ kind: "dependency", keys: ["SILO-33"] }, ["SILO-33"])).toBeNull();
});

test("no extra text when another badge already says it, or nothing is to say", () => {
  expect(startReasonText({ kind: "question", label: "Q14" })).toBeNull();
  expect(startReasonText({ kind: "status" })).toBeNull();
  const hold = { source: "own", key: "SILO-33", reason: "Serveur MinIO", since: "2026-10-16" } as const;
  expect(startReasonText({ kind: "onHold", hold }, [])).toBeNull();
  expect(startReasonText(null)).toBeNull();
});
