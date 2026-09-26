import { expect, test } from "bun:test";
import { toCallResult, toReadResult } from "./result";

test("keeps text and images only, and truncates at the byte limit", () => {
  const raw = {
    content: [
      { type: "text", text: "héllo" },
      { type: "image", data: "AAAA", mimeType: "image/png" },
      { type: "audio", data: "BBBB", mimeType: "audio/wav" },
      { type: "resource_link", uri: "file:///x", name: "x" },
    ],
  };
  expect(toCallResult(raw)).toEqual({
    content: [
      { type: "text", text: "héllo" },
      { type: "image", data: "AAAA", mimeType: "image/png" },
    ],
    isError: false,
    truncated: false,
  });
  const big = toCallResult(
    {
      content: [
        { type: "text", text: "é".repeat(10) },
        { type: "text", text: "tail" },
      ],
    },
    7,
  );
  expect(big).toEqual({ content: [{ type: "text", text: "ééé" }], isError: false, truncated: true });
  expect(toCallResult({ content: [], isError: true }).isError).toBe(true);
  expect(() => toCallResult({ nope: 1 })).toThrow("MCP_FAILED");
});

test("resources become text or image content", () => {
  const raw = {
    contents: [
      { uri: "fake://a", mimeType: "application/json", text: '{"a":1}' },
      { uri: "fake://b", mimeType: "image/png", blob: "AAAA" },
      { uri: "fake://c", mimeType: "application/zip", blob: "ZZZZ" },
    ],
  };
  expect(toReadResult(raw).content).toEqual([
    { type: "text", text: '{"a":1}' },
    { type: "image", data: "AAAA", mimeType: "image/png" },
  ]);
});
