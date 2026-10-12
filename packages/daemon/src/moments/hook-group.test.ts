import { expect, test } from "bun:test";
import type { HookPayload } from "@kibo/schema";
import { HookGroup, hookMoments } from "./hook-group";

const CTX = { stepId: null, now: 1_000 };

const post = (tool: string, detail: string): HookPayload => ({
  event: "PostToolUse",
  sessionId: "s1",
  transcriptPath: null,
  tool,
  detail,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
});

test("a skill used between two reads is its own line, named in full", () => {
  const group = new HookGroup();
  const moments = [
    ...hookMoments(group, post("Read", "a.ts"), CTX),
    ...hookMoments(group, post("Skill", "brainstorming"), CTX),
    ...hookMoments(group, post("Read", "b.ts"), CTX),
    ...group.flush(CTX),
  ];
  const summaries = moments.flatMap((m) => (m.data.kind === "actions" ? [m.data.summary] : []));
  expect(summaries).toEqual(["A lu 1 fichier", "A utilisé le skill `brainstorming`", "A lu 1 fichier"]);
});
