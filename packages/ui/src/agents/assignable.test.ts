import { describe, expect, test } from "bun:test";
import { DEMO_AGENT_REF } from "@kibo/schema";
import { assignableAgents } from "./assignable";
import { agentsSummaryFixture } from "./fixtures";

const [opus, sonnet, haiku] = agentsSummaryFixture;
const demo = opus && { ...opus, ref: DEMO_AGENT_REF, scope: "system" as const, name: "kibo-demo" };

describe("assignableAgents", () => {
  test("keeps usable global and project agents, never a system one outside the demo", () => {
    if (!opus || !sonnet || !haiku || !demo) throw new Error("fixture");
    const agents = [
      opus,
      { ...sonnet, settings: { ...sonnet.settings, enabled: false } },
      { ...haiku, problem: "frontmatter manquant" },
      demo,
    ];
    expect(assignableAgents(agents, false).map((a) => a.name)).toEqual(["opus-dev"]);
    expect(assignableAgents(agents, true).map((a) => a.name)).toEqual(["kibo-demo", "opus-dev"]);
    expect(assignableAgents([{ ...opus, shadowedBy: "global:x" }], false)).toEqual([]);
  });
});
