import { expect, test } from "bun:test";
import { closedGuard } from "./agent-guard";

const denied = (reason: string) => ({ decision: "deny" as const, reason: expect.stringContaining(reason) });

test("the project agent's guard refuses subagents and skills and lets other tools through", () => {
  expect(closedGuard({ tool: "Agent", input: { subagent_type: "general-purpose" } })).toEqual(
    denied("sous-agent"),
  );
  expect(closedGuard({ tool: "Task", input: { subagent_type: "review" } })).toEqual(denied("sous-agent"));
  expect(closedGuard({ tool: "Skill", input: { skill: "brainstorming" } })).toEqual(denied("skill"));
  expect(closedGuard({ tool: "Read", input: { file_path: "a.ts" } })).toBeNull();
});
