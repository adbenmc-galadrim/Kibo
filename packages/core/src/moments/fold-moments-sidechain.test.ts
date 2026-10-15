import { expect, test } from "bun:test";
import { actionsOf, CTX, foldAll } from "./fold-moments.test-helper";

const sidechain = (type: "assistant" | "user", content: unknown[]) =>
  JSON.stringify({ type, isSidechain: true, timestamp: "2026-10-14T10:00:00.000Z", message: { content } });

const LINES = [
  sidechain("assistant", [
    { type: "text", text: "Je relis le diff." },
    { type: "tool_use", id: "toolu_9", name: "Bash", input: { command: "git diff" } },
  ]),
  sidechain("user", [{ type: "tool_result", tool_use_id: "toolu_9", content: "diff" }]),
];

test("sidechain texts make no moment in the main thread", () => {
  const moments = foldAll(LINES);
  expect(moments.map((m) => m.data.kind)).toEqual(["actions"]);
  expect(moments.every((m) => m.subagentId === undefined)).toBe(true);
});

test("a subagent thread reads its sidechain lines as its own and marks its moments", () => {
  const moments = foldAll(LINES, { ...CTX, subagentId: "a1", sidechainAsMain: true });
  expect(moments.map((m) => m.data.kind)).toEqual(["message", "actions"]);
  expect(actionsOf(moments).map((a) => a.command ?? a.target)).toEqual(["git diff"]);
  expect(moments.every((m) => m.subagentId === "a1")).toBe(true);
});
