import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createSkippedNotes } from "./skipped-notes";

test("a skipped note is logged again when its reason changes, per project", () => {
  const lines: string[] = [];
  const skipped = createSkippedNotes((line) => lines.push(line));
  const tooLarge = { path: "a.md", error: new KiboError("QUOTA_EXCEEDED", "a.md is larger than 1 MiB") };
  const gone = { path: "a.md", error: new KiboError("NOT_FOUND", "note a.md not found") };
  skipped.report("p1", [tooLarge]);
  skipped.report("p1", [tooLarge]);
  skipped.report("p2", [tooLarge]);
  skipped.report("p1", [gone]);
  skipped.report("p1", [gone]);
  expect(lines).toEqual([
    "note a.md skipped: QUOTA_EXCEEDED: a.md is larger than 1 MiB",
    "note a.md skipped: QUOTA_EXCEEDED: a.md is larger than 1 MiB",
    "note a.md skipped: NOT_FOUND: note a.md not found",
  ]);
});
