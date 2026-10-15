import { expect, test } from "bun:test";
import type { RunAction, RunMoment } from "@kibo/schema";
import { feedMoments } from "./feed-moments";
import { CORRECTNESS, LAUNCH_MOMENTS } from "./subagent-fixtures";

const scope = { showReasoning: false, subagentId: null, subagents: new Map([[CORRECTNESS.id, CORRECTNESS]]) };

const launches = (moments: readonly RunMoment[]): RunAction[] =>
  moments.flatMap((m) =>
    m.data.kind === "actions" ? m.data.actions.filter((a) => a.kind === "subagent") : [],
  );

test("a launch with its subagent line is folded into that line", () => {
  expect(launches(feedMoments(LAUNCH_MOMENTS, scope))).toEqual([]);
});

test("a refused launch always stays in the feed, even with a matching subagent line", () => {
  const refused = LAUNCH_MOMENTS.map((m) =>
    m.data.kind === "actions"
      ? {
          ...m,
          data: {
            ...m.data,
            actions: m.data.actions.map((a) =>
              a.kind === "subagent" ? { ...a, outcome: "denied" as const } : a,
            ),
          },
        }
      : m,
  );
  expect(launches(feedMoments(refused, scope))).toEqual([
    expect.objectContaining({ callId: CORRECTNESS.toolUseId, outcome: "denied" }),
  ]);
});
