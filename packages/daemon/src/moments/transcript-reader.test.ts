import { afterEach, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLongLine, readTranscriptSlice } from "./transcript-reader";

const dirs: string[] = [];
const file = (content: string) => {
  const d = mkdtempSync(join(tmpdir(), "kibo-reader-"));
  dirs.push(d);
  const path = join(d, "s.jsonl");
  writeFileSync(path, content);
  return path;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("a whole file of complete lines is read in one slice", () => {
  const content = '{"a":1}\n{"b":"é"}\n{"c":3}\n';
  const path = file(content);
  expect(readTranscriptSlice(path, 0)).toEqual({
    lines: ['{"a":1}', '{"b":"é"}', '{"c":3}'],
    offset: Buffer.byteLength(content),
    more: false,
  });
});

test("a last line without newline is kept for the next slice", () => {
  const path = file('{"a":1}\n{"b":');
  expect(readTranscriptSlice(path, 0)).toEqual({ lines: ['{"a":1}'], offset: 8, more: false });
  appendFileSync(path, '2}\n{"c":3}\n');
  expect(readTranscriptSlice(path, 8)).toEqual({ lines: ['{"b":2}', '{"c":3}'], offset: 24, more: false });
  expect(readTranscriptSlice(path, 24)).toEqual({ lines: [], offset: 24, more: false });
});

test("a slice reads at most maxBytes and the next one resumes at the offset", () => {
  const path = file("aaaa\nbbbb\ncccc\n");
  expect(readTranscriptSlice(path, 0, 12)).toEqual({ lines: ["aaaa", "bbbb"], offset: 10, more: true });
  expect(readTranscriptSlice(path, 10, 12)).toEqual({ lines: ["cccc"], offset: 15, more: false });
});

test("a line longer than maxBytes yields nothing but more, and is read apart", () => {
  const long = "x".repeat(20);
  const path = file(`${long}\nok\n`);
  expect(readTranscriptSlice(path, 0, 10)).toEqual({ lines: [], offset: 0, more: true });
  expect(readLongLine(path, 0, 8)).toEqual({ head: "xxxxxxxx", offset: 21 });
  expect(readTranscriptSlice(path, 21, 10)).toEqual({ lines: ["ok"], offset: 24, more: false });
});

test("a long line still being written is not skipped", () => {
  const path = file("x".repeat(30));
  expect(readLongLine(path, 0, 8)).toBeNull();
});

test("a missing file is NOT_FOUND", () => {
  expect(() => readTranscriptSlice(join(tmpdir(), "kibo-absent", "s.jsonl"), 0)).toThrow("NOT_FOUND");
});
