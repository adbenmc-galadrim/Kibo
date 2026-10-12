import { describe, expect, test } from "bun:test";
import { hasSecret, MOMENT_ACTIONS_MAX, MOMENT_RAW_MAX, MomentData } from "@kibo/schema";
import fc from "fast-check";
import { emptyFold, type Folded, flushActions, foldLines } from "./fold-moments";
import { actionsOf, CTX, fixtureLines, foldAll } from "./fold-moments.test-helper";

const stringsOf = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsOf);
  return [];
};

describe("a real edit and test session", () => {
  const moments = foldAll(fixtureLines("real-edit-bash"));

  test("folds into message, actions, reasoning, message", () => {
    expect(moments.map((m) => m.data.kind)).toEqual(["message", "actions", "reasoning", "message"]);
    expect(moments[0]?.data).toEqual({ kind: "message", text: "Je commence par lire le formulaire." });
  });

  test("the actions read, edit with a patch and a failing test, all summarized", () => {
    const data = moments[1]?.data;
    if (data?.kind !== "actions") throw new Error("expected actions");
    expect(data.actions.map((a) => [a.kind, a.outcome])).toEqual([
      ["read", "ok"],
      ["edit", "ok"],
      ["test", "error"],
    ]);
    expect(data.actions[1]?.label).toBe("A modifié `LoginForm.tsx` (+2 −1)");
    expect(data.actions[2]?.tests).toEqual({ passed: 12, failed: 1 });
    expect(data.summary).toBe("A lu 1 fichier, modifié 1 fichier et lancé les tests (12 réussis, 1 échec)");
    expect(data.failed).toBe(true);
  });

  test("moments carry the step of the context and the line date", () => {
    expect(moments.every((m) => m.stepId === "s2")).toBe(true);
    expect(moments[0]?.at).toBe(Date.parse("2026-10-10T09:00:02.000Z"));
    expect(moments[1]?.at).toBe(Date.parse("2026-10-10T09:00:04.000Z"));
  });

  test("every moment fits the schema", () => {
    for (const m of moments) expect(MomentData.parse(m.data)).toEqual(m.data);
  });

  test("folding line by line gives the same moments as folding at once", () => {
    let state = emptyFold();
    const oneByOne: Folded["moments"] = [];
    for (const line of fixtureLines("real-edit-bash")) {
      const folded = foldLines(state, [line], CTX);
      state = folded.state;
      oneByOne.push(...folded.moments);
    }
    oneByOne.push(...flushActions(state, CTX).moments);
    expect(oneByOne).toEqual(moments);
  });
});

test("a tool result without its tool use is an unknown tool action", () => {
  const line = JSON.stringify({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: "lost", content: "ok" }] },
  });
  const [action] = actionsOf(foldAll([line]));
  expect(action).toMatchObject({ kind: "other", label: "A utilisé un outil", outcome: "ok", detail: "ok" });
});

test("a tool use left without result is flushed as done, without detail", () => {
  const lines = fixtureLines("truncated");
  const folded = foldLines(emptyFold(), lines, CTX);
  expect(folded.moments.map((m) => m.data.kind)).toEqual(["message"]);
  expect(folded.state.pending.size).toBe(1);
  const flushed = flushActions(folded.state, { stepId: null, now: 5_000 });
  expect(flushed.moments).toEqual([
    {
      at: 5_000,
      stepId: null,
      data: expect.objectContaining({ kind: "actions", failed: false }),
    },
  ]);
  expect(actionsOf(flushed.moments)[0]).toMatchObject({ kind: "test", outcome: "ok", detail: null });
  expect(flushed.state).toEqual({ ...emptyFold(), known: true });
});

test("an empty flush yields nothing", () => {
  expect(flushActions(emptyFold(), CTX)).toEqual({ state: emptyFold(), moments: [] });
});

test("unknown lines become raw moments, bounded, and mark the fold as unknown", () => {
  const folded = foldLines(emptyFold(), fixtureLines("unknown-format"), CTX);
  expect(folded.moments.map((m) => m.data)).toEqual([
    { kind: "raw", text: "ceci n'est pas du JSON", partial: null },
    { kind: "raw", text: "{}", partial: null },
    { kind: "raw", text: '{"type":"assistant"}', partial: null },
  ]);
  expect(folded.moments.every((m) => m.at === CTX.now)).toBe(true);
  expect(folded.state.known).toBe(false);
  const long = foldLines(emptyFold(), ["x".repeat(5_000)], CTX).moments[0]?.data;
  expect(long?.kind === "raw" && long.text.length).toBe(MOMENT_RAW_MAX);
});

test("an entry of an unknown type yields nothing and leaves the fold unknown", () => {
  const folded = foldLines(emptyFold(), [JSON.stringify({ type: "mystery", value: 1 })], CTX);
  expect(folded).toEqual({ state: emptyFold(), moments: [] });
});

test("a recognized line marks the fold as known", () => {
  expect(foldLines(emptyFold(), [JSON.stringify({ type: "summary" })], CTX).state.known).toBe(true);
});

test("a raw line closes the pending group of actions first", () => {
  const lines = fixtureLines("real-edit-bash").slice(1, 4);
  const folded = foldLines(emptyFold(), [...lines, "pas du JSON"], CTX);
  expect(folded.moments.map((m) => m.data.kind)).toEqual(["message", "actions", "raw"]);
});

test("no secret survives the fold", () => {
  const moments = foldAll(fixtureLines("secrets"));
  expect(stringsOf(moments).filter(hasSecret)).toEqual([]);
  const text = JSON.stringify(moments);
  expect(text).not.toContain("FAKEfake");
  expect(text).not.toContain("FAKEtoken");
  expect(text).not.toContain("FAKEbearer");
  expect(text).not.toContain("b3BlbnNzaC1rZXktdjEAAAAA");
  expect(text).not.toContain("AKIAFAKE");
  const [command] = actionsOf(moments);
  expect(command?.target).toBe("GITHUB_TOKEN=‹masqué› gh pr list");
  expect(command?.label).toBe("A lancé `GITHUB_TOKEN=‹masqué› gh pr list`");
});

test("a secret cut by a field limit is still masked", () => {
  const command = `${"a".repeat(110)} API_KEY=FAKEsecretFAKEsecret`;
  const lines = [
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", id: "t", name: "Bash", input: { command } }] },
    }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] },
    }),
  ];
  const moments = foldAll(lines);
  expect(stringsOf(moments).filter(hasSecret)).toEqual([]);
  expect(JSON.stringify(moments)).not.toContain("FAKEsecret");
});

test("sidechain tools count, sidechain texts do not", () => {
  const moments = foldAll(fixtureLines("sidechain"));
  expect(moments.map((m) => m.data.kind)).toEqual(["actions", "message"]);
  expect(actionsOf(moments).map((a) => a.kind)).toEqual(["search", "subagent"]);
  expect(moments[1]?.data).toEqual({ kind: "message", text: "Le sous-agent a trouvé la validation." });
});

test("a refused tool is denied, an ordinary output mentioning a denial is not", () => {
  const call = (id: string, output: string, isError: boolean): string[] => [
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", id, name: "Read", input: {} }] },
    }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: id, content: output, is_error: isError }] },
    }),
  ];
  const actions = actionsOf(
    foldAll([
      ...call("a", "The user doesn't want to proceed with this tool use.", true),
      ...call("b", "access denied", false),
    ]),
  );
  expect(actions.map((a) => a.outcome)).toEqual(["denied", "ok"]);
});

test("more actions than a moment holds are split into several moments", () => {
  const lines = Array.from({ length: MOMENT_ACTIONS_MAX + 5 }, (_, i) => [
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", id: `t${i}`, name: "Read", input: {} }] },
    }),
    JSON.stringify({
      type: "user",
      message: { content: [{ type: "tool_result", tool_use_id: `t${i}`, content: "" }] },
    }),
  ]).flat();
  const moments = foldAll(lines);
  expect(moments.map((m) => (m.data.kind === "actions" ? m.data.actions.length : 0))).toEqual([
    MOMENT_ACTIONS_MAX,
    5,
  ]);
});

test("empty texts produce no message", () => {
  const line = JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "  " },
        { type: "thinking", thinking: "" },
      ],
    },
  });
  expect(foldAll([line])).toEqual([]);
});

type Gen = { kind: "text"; text: string } | { kind: "use"; side: boolean } | { kind: "result"; pick: number };

const step: fc.Arbitrary<Gen> = fc.oneof(
  fc.record({ kind: fc.constant("text" as const), text: fc.string() }),
  fc.record({ kind: fc.constant("use" as const), side: fc.boolean() }),
  fc.record({ kind: fc.constant("result" as const), pick: fc.nat() }),
);

function linesOf(steps: readonly Gen[]): { lines: string[]; uses: number } {
  const open: string[] = [];
  const lines: string[] = [];
  let uses = 0;
  for (const s of steps) {
    if (s.kind === "text") {
      lines.push(
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: s.text }] } }),
      );
    } else if (s.kind === "use") {
      const id = `t${uses++}`;
      open.push(id);
      const content = [{ type: "tool_use", id, name: "Bash", input: { command: "ls" } }];
      lines.push(JSON.stringify({ type: "assistant", isSidechain: s.side, message: { content } }));
    } else if (open.length > 0) {
      const [id] = open.splice(s.pick % open.length, 1);
      const content = [{ type: "tool_result", tool_use_id: id, content: "ok" }];
      lines.push(JSON.stringify({ type: "user", message: { content } }));
    }
  }
  return { lines, uses };
}

test("every tool use becomes exactly one action and no group of actions is empty", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 60 }), (steps) => {
      const { lines, uses } = linesOf(steps);
      const moments = foldAll(lines);
      expect(actionsOf(moments)).toHaveLength(uses);
      for (const m of moments) {
        if (m.data.kind === "actions") expect(m.data.actions.length).toBeGreaterThan(0);
      }
    }),
  );
});
