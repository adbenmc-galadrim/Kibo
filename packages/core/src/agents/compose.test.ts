import { describe, expect, test } from "bun:test";
import { type AgentFile, DEFAULT_AGENT_SETTINGS, KiboError } from "@kibo/schema";
import { readProject } from "../commands";
import { createProjectDoc } from "../project";
import { exampleTicket, launchFlags, NO_AGENT, runModel, skillAllowRule, subagentsJson } from "./compose";

const file = (over: Partial<AgentFile["frontmatter"]> = {}, body = "Tu relis."): AgentFile => ({
  frontmatter: { name: "review", description: "Relit", extra: "color: blue", extraKeys: ["color"], ...over },
  body,
});

describe("run model", () => {
  test("absent or inherit falls back to Sonnet", () => {
    expect(runModel(null)).toEqual({ model: "sonnet", inherited: true });
    expect(runModel({ model: "inherit" })).toEqual({ model: "sonnet", inherited: true });
    expect(runModel({})).toEqual({ model: "sonnet", inherited: true });
    expect(runModel({ model: "fable" })).toEqual({ model: "fable", inherited: false });
  });
});

describe("agents.json", () => {
  test("holds the description, the body as prompt, the tools and the model, never the extra keys", () => {
    const json = JSON.parse(
      subagentsJson([
        { name: "review", file: file({ tools: ["Read"], model: "haiku" }) },
        { name: "seo", file: file({ name: "seo", description: "Audite" }, "Audit.") },
      ]),
    );
    expect(json).toEqual({
      review: { description: "Relit", prompt: "Tu relis.", tools: ["Read"], model: "haiku" },
      seo: { description: "Audite", prompt: "Audit." },
    });
  });
  test("refuses more than twenty subagents", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `a${i}`, file: file() }));
    expect(() => subagentsJson(many)).toThrow(KiboError);
    expect(subagentsJson([])).toBe("{}");
  });
});

describe("launch flags", () => {
  test("add one Skill rule per allowed skill after the allow rules", () => {
    const flags = launchFlags(file({ tools: ["Read"] }).frontmatter, {
      ...DEFAULT_AGENT_SETTINGS,
      allow: ["Bash(git *)"],
      skills: { mode: "list", ids: ["a", "p:b"] },
    });
    expect(flags).toEqual({
      model: "sonnet",
      tools: ["Read"],
      disallowedTools: null,
      allowRules: ["Bash(git *)", "Skill(a)", "Skill(p:b)"],
    });
    expect(skillAllowRule("p:b")).toBe("Skill(p:b)");
  });
  test("in mode all, no Skill rule and no tools list", () => {
    expect(launchFlags(null, DEFAULT_AGENT_SETTINGS)).toEqual({
      model: "sonnet",
      tools: null,
      disallowedTools: null,
      allowRules: [],
    });
  });
});

test("the neutral agent has no name, no body and every skill", () => {
  expect(NO_AGENT).toEqual({ name: "", body: "", subagents: [], skills: { mode: "all" }, preloaded: [] });
});

test("an example ticket stands in when none is chosen", () => {
  const doc = createProjectDoc({
    id: "p1",
    key: "BOU",
    name: "Boutique",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  });
  const ticket = exampleTicket(readProject(doc, "2026-10-16"));
  expect(ticket.key).toBe("BOU-0");
  expect(ticket.keyLabel).toBe("BOU-0");
  expect(ticket.title).toBe("Ticket d'exemple");
});
