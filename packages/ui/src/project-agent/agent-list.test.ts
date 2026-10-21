import { expect, test } from "bun:test";
import { agentLabel, agentListItems } from "./agent-list";
import { session } from "./fixtures";

const NOW = new Date(2026, 9, 16, 14, 40).getTime();
const MIN = 60_000;
const DAY = 86_400_000;

test("the current agent comes first, named by its first question, then the past ones newest first", () => {
  const view = {
    session: session({ runId: "r3", title: "Fais le point du jour", messages: 4, startedAt: NOW - 20 * MIN }),
    past: [
      session({
        runId: "r1",
        title: "Relances client",
        messages: 3,
        startedAt: NOW - 14 * DAY,
        closedAt: NOW - 13 * DAY,
      }),
      session({ runId: "r2", title: null, messages: 1, startedAt: NOW - 7 * DAY, closedAt: NOW - 6 * DAY }),
    ],
  };
  expect(agentListItems(view, NOW).map((i) => [i.runId, i.label, i.messages, i.current])).toEqual([
    ["r3", "Fais le point du jour", 4, true],
    ["r2", "Agent du 9 oct.", 1, false],
    ["r1", "Relances client", 3, false],
  ]);
  expect(agentListItems(view, NOW)[0]?.date).toBe("14:20");
  expect(agentListItems(view, NOW)[2]?.date).toBe("2 oct.");
  expect(agentListItems({ session: null, past: [] }, NOW)).toEqual([]);
});

test("an agent without a first question is named by its day", () => {
  expect(agentLabel({ title: null, startedAt: NOW })).toBe("Agent du 16 oct.");
  expect(agentLabel({ title: "Relances client", startedAt: NOW })).toBe("Relances client");
});
