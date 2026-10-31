import { expect, test } from "bun:test";
import type { T3ThreadStatus } from "@kibo/schema";
import { isKnownT3Status, mapT3Status } from "./status-map";

const TABLE: [string, T3ThreadStatus][] = [
  ["running", "running"],
  ["preparing", "running"],
  ["queued", "running"],
  ["starting", "running"],
  ["waiting", "waiting"],
  ["idle", "waiting"],
  ["completed", "done"],
  ["failed", "failed"],
  ["interrupted", "failed"],
  ["cancelled", "failed"],
  ["rolled_back", "failed"],
];

test.each(TABLE)("%s maps to %s", (raw, status) => {
  expect(mapT3Status(raw)).toBe(status);
});

test("an unknown status maps to running", () => {
  expect(mapT3Status("something-new")).toBe("running");
});

test("only the table is known", () => {
  expect(isKnownT3Status("idle")).toBe(true);
  expect(isKnownT3Status("something-new")).toBe(false);
});
