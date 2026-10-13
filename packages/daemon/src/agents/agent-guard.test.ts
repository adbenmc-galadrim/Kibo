import { expect, test } from "bun:test";
import { DEFAULT_AGENT_SETTINGS } from "@kibo/schema";
import { agentGuardOf } from "./agent-guard";

const denied = (reason: string) => ({ decision: "deny" as const, reason: expect.stringContaining(reason) });

test("without an agent the guard refuses subagents and skills and lets other tools through", () => {
  const guard = agentGuardOf(null);
  expect(guard({ tool: "Agent", input: { subagent_type: "general-purpose" } })).toEqual(denied("sous-agent"));
  expect(guard({ tool: "Task", input: { subagent_type: "review" } })).toEqual(denied("sous-agent"));
  expect(guard({ tool: "Skill", input: { skill: "brainstorming" } })).toEqual(denied("skill"));
  expect(guard({ tool: "Read", input: { file_path: "a.ts" } })).toBeNull();
});

test("an agent's guard allows its callable subagents by name and its listed skills", () => {
  const guard = agentGuardOf({
    settings: {
      ...DEFAULT_AGENT_SETTINGS,
      subagents: ["global:livraison", "project:11111111-1111-4111-8111-111111111111:review-pr"],
      genericSubagents: false,
      skills: { mode: "list", ids: ["brainstorming"] },
    },
  });
  expect(guard({ tool: "Agent", input: { subagent_type: "livraison" } })).toBeNull();
  expect(guard({ tool: "Agent", input: { subagent_type: "review-pr" } })).toBeNull();
  expect(guard({ tool: "Agent", input: { subagent_type: "Explore" } })).toEqual(denied("sous-agent"));
  expect(guard({ tool: "Skill", input: { skill: "brainstorming" } })).toBeNull();
  expect(guard({ tool: "Skill", input: { skill: "deploy" } })).toEqual(denied("skill non autorisé"));
  expect(guard({ tool: "Skill", input: null })).toEqual(denied("skill"));
});

test("an agent with every skill and generic subagents only refuses unknown subagents", () => {
  const guard = agentGuardOf({ settings: DEFAULT_AGENT_SETTINGS });
  expect(guard({ tool: "Skill", input: { skill: "anything" } })).toBeNull();
  expect(guard({ tool: "Agent", input: { subagent_type: "general-purpose" } })).toBeNull();
  expect(guard({ tool: "Agent", input: { subagent_type: "seo" } })).toEqual(denied("sous-agent"));
});

test("an agent allowed every subagent lets plugin and machine agents through", () => {
  const guard = agentGuardOf({ settings: { ...DEFAULT_AGENT_SETTINGS, allSubagents: true } });
  expect(guard({ tool: "Agent", input: { subagent_type: "ecc:typescript-reviewer" } })).toBeNull();
  expect(guard({ tool: "Task", input: { subagent_type: "kibo-dev" } })).toBeNull();
});
