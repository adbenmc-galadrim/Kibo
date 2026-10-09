import { expect, test } from "bun:test";
import { noteHashOf as demoNoteHashOf } from "../demo/demo-project";
import { noteHashOf } from "./note-hash";

test("noteHashOf is the sha256 hex of the markdown", () => {
  expect(noteHashOf("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  expect(noteHashOf("# A\n")).toMatch(/^[0-9a-f]{64}$/);
  expect(noteHashOf("# A\n")).not.toBe(noteHashOf("# B\n"));
});

test("the demo project re-exports the same hash", () => {
  expect(demoNoteHashOf).toBe(noteHashOf);
});
