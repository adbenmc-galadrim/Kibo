import { describe, expect, test } from "bun:test";
import { agentGuard, GENERIC_SUBAGENTS } from "./guard";

const rules = {
  subagents: ["review"],
  genericSubagents: true,
  allSubagents: false,
  skills: { mode: "list" as const, ids: ["brainstorming", "superpowers:brainstorming"] },
};
const guard = agentGuard(rules);
const deny = (reason: string) => ({ decision: "deny" as const, reason: expect.stringContaining(reason) });

describe("agent guard", () => {
  test("lets the listed and generic subagents through, refuses the others", () => {
    expect(guard({ tool: "Agent", input: { subagent_type: "review" } })).toBeNull();
    expect(guard({ tool: "Agent", input: { subagent_type: "seo" } })).toEqual(
      deny("sous-agent non autorisé par Kibo"),
    );
    expect(guard({ tool: "Agent", input: { subagent_type: "general-purpose" } })).toBeNull();
    expect(GENERIC_SUBAGENTS).toEqual(["general-purpose", "Explore", "Plan"]);
    const strict = agentGuard({ ...rules, genericSubagents: false });
    expect(strict({ tool: "Agent", input: { subagent_type: "general-purpose" } })).toEqual(
      deny("sous-agent non autorisé par Kibo"),
    );
  });

  test("lets any subagent through when all subagents are allowed", () => {
    const open = agentGuard({ ...rules, genericSubagents: false, allSubagents: true });
    expect(open({ tool: "Agent", input: { subagent_type: "ecc:code-reviewer" } })).toBeNull();
    expect(open({ tool: "Task", input: { subagent_type: "kibo-dev" } })).toBeNull();
    expect(open({ tool: "Agent", input: { subagent_type: "Explore" } })).toBeNull();
    expect(open({ tool: "Skill", input: { skill: "deploy" } })).toEqual(deny("skill non autorisé par Kibo"));
  });

  test("treats Task as Agent and refuses a call without subagent type", () => {
    expect(guard({ tool: "Task", input: { subagent_type: "seo" } })).toEqual(deny("sous-agent"));
    expect(guard({ tool: "Task", input: { subagent_type: "review" } })).toBeNull();
    expect(guard({ tool: "Agent", input: {} })).toEqual(deny("sous-agent"));
  });

  test("lets the allowed skills through and refuses the others", () => {
    expect(guard({ tool: "Skill", input: { skill: "brainstorming" } })).toBeNull();
    expect(guard({ tool: "Skill", input: { skill: "superpowers:brainstorming" } })).toBeNull();
    expect(guard({ tool: "Skill", input: { skill: "deploy" } })).toEqual(deny("skill non autorisé par Kibo"));
    expect(guard({ tool: "Skill", input: { name: "deploy" } })).toEqual(deny("skill non autorisé par Kibo"));
    expect(guard({ tool: "Skill", input: {} })).toEqual(deny("skill non autorisé par Kibo"));
  });

  test("never refuses a skill in mode all, nor another tool", () => {
    const all = agentGuard({ ...rules, skills: { mode: "all" } });
    expect(all({ tool: "Skill", input: { skill: "deploy" } })).toBeNull();
    expect(all({ tool: "Skill", input: {} })).toBeNull();
    expect(guard({ tool: "Read", input: { file_path: "a.ts" } })).toBeNull();
  });
});
