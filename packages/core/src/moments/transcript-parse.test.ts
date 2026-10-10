import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { IGNORED_ENTRY_TYPES, type ParsedLine, parseTranscriptLine, patchOf } from "./transcript-parse";

const fixtureText = (name: string): string =>
  readFileSync(join(import.meta.dir, "fixtures", "transcripts", `${name}.jsonl`), "utf8");

const fixtureLines = (name: string): string[] => {
  const parts = fixtureText(name).split("\n");
  parts.pop();
  return parts;
};

const at = (second: number): number => Date.parse(`2026-10-10T09:00:${String(second).padStart(2, "0")}.000Z`);

describe("parseTranscriptLine on a real edit and test session", () => {
  const parsed = fixtureLines("real-edit-bash").map(parseTranscriptLine);

  test("the prompt is a user line with its text", () => {
    expect(parsed[0]).toEqual({
      kind: "user",
      text: "Corrige la validation du formulaire de connexion (KIB-14).",
      results: [],
      toolUseResult: null,
      sidechain: false,
      at: at(1),
    });
  });

  test("assistant text, tool use and thinking become blocks", () => {
    expect(parsed[1]).toEqual({
      kind: "assistant",
      blocks: [{ type: "text", text: "Je commence par lire le formulaire." }],
      sidechain: false,
      at: at(2),
    });
    expect(parsed[2]).toMatchObject({
      kind: "assistant",
      blocks: [
        { type: "tool_use", id: "toolu_read", name: "Read", input: { file_path: "/repo/src/LoginForm.tsx" } },
      ],
    });
    expect(parsed[8]).toMatchObject({
      kind: "assistant",
      blocks: [{ type: "thinking", thinking: "Un test échoue encore : la règle de l'e-mail vide." }],
    });
  });

  test("a tool result keeps its content, error flag and tool use result", () => {
    expect(parsed[5]).toMatchObject({
      kind: "user",
      text: null,
      results: [
        {
          type: "tool_result",
          tool_use_id: "toolu_edit",
          content: "The file /repo/src/LoginForm.tsx has been updated.",
          is_error: false,
        },
      ],
    });
    expect(patchOf(parsed[5]?.kind === "user" ? parsed[5].toolUseResult : null)).toEqual({
      added: 2,
      removed: 1,
    });
    expect(parsed[7]).toMatchObject({
      kind: "user",
      results: [{ tool_use_id: "toolu_bash", content: "Exit code 1\n 12 pass\n 1 fail", is_error: true }],
    });
  });

  test("summary and system entries are ignored", () => {
    expect(parsed[10]).toEqual({ kind: "ignored" });
    expect(parsed[11]).toEqual({ kind: "ignored" });
  });
});

test("every ignored entry type is ignored", () => {
  for (const type of IGNORED_ENTRY_TYPES) {
    expect(parseTranscriptLine(JSON.stringify({ type }))).toEqual({ kind: "ignored" });
  }
});

test("unknown formats become raw lines", () => {
  const lines = fixtureLines("unknown-format");
  expect(lines.map(parseTranscriptLine)).toEqual(lines.map((text) => ({ kind: "raw", text })));
});

test("a line cut in the middle is raw, never a half parsed entry", () => {
  const cut = fixtureText("truncated").split("\n").at(-1) ?? "";
  expect(cut.length).toBeGreaterThan(0);
  expect(parseTranscriptLine(cut)).toEqual({ kind: "raw", text: cut });
});

test("a blank line is ignored", () => {
  expect(parseTranscriptLine("   ")).toEqual({ kind: "ignored" });
});

test("tool result content given as blocks is joined", () => {
  const line = JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "t1",
          content: [
            { type: "text", text: "a" },
            { type: "image", source: {} },
            { type: "text", text: "b" },
          ],
        },
      ],
    },
  });
  expect(parseTranscriptLine(line)).toMatchObject({ results: [{ content: "a\nb", is_error: false }] });
});

test("a tool result without content has a null content", () => {
  const line = JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1" }] },
  });
  expect(parseTranscriptLine(line)).toMatchObject({ results: [{ content: null }] });
});

test("an unreadable timestamp gives a null date", () => {
  const line = JSON.stringify({ type: "assistant", timestamp: "hier", message: { content: "Bonjour" } });
  expect(parseTranscriptLine(line)).toEqual({
    kind: "assistant",
    blocks: [{ type: "text", text: "Bonjour" }],
    sidechain: false,
    at: null,
  });
});

test("unknown content blocks are dropped and a tool use without object input gets an empty one", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "redacted_thinking", data: "x" },
        { type: "tool_use", id: "t", name: "Read", input: "oops" },
      ],
    },
  });
  expect(parseTranscriptLine(line)).toMatchObject({
    blocks: [{ type: "tool_use", id: "t", name: "Read", input: {} }],
  });
});

test("a sidechain line is flagged", () => {
  expect(fixtureLines("sidechain").map(parseTranscriptLine)[2]).toMatchObject({
    kind: "assistant",
    sidechain: true,
  });
});

test("patches count added and removed lines, not file headers", () => {
  expect(patchOf({ structuredPatch: [{ lines: ["+++ b/x", "--- a/x", "+a", " b", "-c", "-d"] }] })).toEqual({
    added: 1,
    removed: 2,
  });
  expect(patchOf({ type: "text" })).toBeNull();
  expect(patchOf(null)).toBeNull();
  expect(patchOf({ structuredPatch: "x" })).toBeNull();
});

const KINDS: readonly ParsedLine["kind"][] = ["assistant", "user", "ignored", "raw"];

test("parsing never throws, whatever the line", () => {
  const anyJson = fc.jsonValue().map((v) => JSON.stringify(v));
  const entry = fc
    .record({
      type: fc.constantFrom("assistant", "user", "summary", "mystery"),
      message: fc.anything(),
      timestamp: fc.oneof(fc.string(), fc.integer()),
    })
    .map((v) => JSON.stringify(v));
  fc.assert(
    fc.property(fc.oneof(fc.string(), anyJson, entry), (line) => {
      expect(KINDS).toContain(parseTranscriptLine(line).kind);
    }),
  );
});
