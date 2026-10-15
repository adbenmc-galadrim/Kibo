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

const handback = (message: unknown) =>
  JSON.stringify({
    type: "assistant",
    isSidechain: true,
    timestamp: "2026-10-15T06:01:09.880Z",
    message: {
      model: "claude-haiku-5-5",
      content: [{ type: "tool_use", id: "toolu_h", name: "SubagentHandback", input: { message } }],
    },
  });

test("a background subagent's report through SubagentHandback is its last message", () => {
  const moments = foldAll([handback("Rien à signaler.")], {
    ...CTX,
    subagentId: "a1",
    sidechainAsMain: true,
  });
  expect(moments.map((m) => m.data)).toEqual([
    { kind: "message", text: "Rien à signaler." },
    expect.objectContaining({ kind: "actions" }),
  ]);
  expect(moments[0]?.at).toBe(Date.parse("2026-10-15T06:01:09.880Z"));
});

test("a handback outside a subagent thread or without text is no message", () => {
  expect(foldAll([handback("Rien à signaler.")]).map((m) => m.data.kind)).toEqual(["actions"]);
  const sub = { ...CTX, subagentId: "a1", sidechainAsMain: true };
  expect(foldAll([handback(42)], sub).map((m) => m.data.kind)).toEqual(["actions"]);
});
