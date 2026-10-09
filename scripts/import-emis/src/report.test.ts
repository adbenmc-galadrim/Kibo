import { expect, test } from "bun:test";
import { buildReport } from "./report";

test("the report lists every change but plain kept ones; a field kept for Kibo is listed", () => {
  const report = buildReport([
    { kind: "kept", what: "ticket C0-1", detail: "Socle" },
    { kind: "kept", what: "ticket C0-10", detail: "status (Kibo)" },
    { kind: "updated", what: "ticket C1-2", detail: "description" },
  ]);
  expect(report).toMatchObject({ kept: 2, updated: 1 });
  expect(report.lines).toEqual(["kept ticket C0-10 · status (Kibo)", "updated ticket C1-2 · description"]);
});
