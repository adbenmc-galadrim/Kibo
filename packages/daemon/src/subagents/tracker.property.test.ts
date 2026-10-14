import { expect, test } from "bun:test";
import fc from "fast-check";
import type { SubagentTracker } from "./tracker";
import { AGENT, hook, LAUNCH, META, RUN, TOOL_USE, tracked } from "./tracker.test-helper";

type Signal = (tracker: SubagentTracker) => void;
const SIGNALS: Signal[] = [
  (t) => t.onLaunch(RUN, LAUNCH),
  (t) => t.onMeta(RUN, META),
  (t) => t.onHook(RUN, hook("SubagentStart")),
  (t) => t.onSlice(RUN, AGENT, ['{"type":"assistant"}']),
  (t) => t.onHook(RUN, hook("SubagentStop")),
  (t) => t.onResult(RUN, TOOL_USE, false, "RAS"),
];

function finalState(order: readonly number[]) {
  const { tracker, store, announced } = tracked();
  for (const index of order) SIGNALS[index]?.(tracker);
  return { subagents: store.list(RUN), announced };
}

test("any order of the signals gives exactly one line and the same final state", () => {
  const reference = finalState([0, 1, 2, 3, 4, 5]);
  expect(reference.subagents).toHaveLength(1);
  fc.assert(
    fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4, 5], { minLength: 6 }), (order) => {
      const state = finalState(order);
      expect(state.subagents).toEqual(reference.subagents);
      expect(state.announced).toEqual(reference.announced);
    }),
    { numRuns: 200 },
  );
});
